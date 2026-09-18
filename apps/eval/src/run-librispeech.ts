import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
} from "@aws-sdk/client-transcribe";
import {
  normalizeTranscribe,
  segmentWords,
  transcribeItemsToWords,
  type CaptionWord,
  type TranscribeResult,
} from "@everyword/captions-core";

/**
 * External evaluation for EveryWord (winner pattern: numbers from data we
 * did not author).
 *
 * Reference: LibriSpeech dev-clean utterances with gold word alignments
 * (Montreal Forced Aligner), via the Hugging Face dataset
 * gilkeyio/librispeech-alignments. LibriSpeech is public-domain-derived
 * audiobook speech (CC-BY licensed corpus); neither the recordings nor
 * the alignments are ours.
 *
 * Method:
 * 1. Deterministically sample utterances spread across the split (fixed
 *    offsets, many speakers), fetch audio and gold word timings.
 * 2. Stitch the audio into one file with 1s silences between utterances
 *    (ffmpeg), tracking each utterance's global offset.
 * 3. One Amazon Transcribe pass, the same service the production caption
 *    pipeline uses, cached locally so reruns are free.
 * 4. Align hypothesis words to gold words per utterance (edit-distance
 *    alignment on normalized tokens) and measure:
 *      - onset error of the karaoke highlight (median, p90)
 *      - the negative control: how often a word would light EARLY, before
 *        it is spoken, beyond a 150 ms tolerance
 *      - line quality: percentage of line breaks landing on real pauses
 *        (gold inter-word gap >= 300 ms), for the EveryWord segmenter
 *        versus a naive fixed-width chunker that ignores timing.
 *
 * Usage: npm run librispeech -w @everyword/eval
 * Results: results/librispeech.json for dev_clean, results/librispeech-<split>.json
 * for any other split, plus a console summary.
 */

/**
 * Which LibriSpeech split to measure against.
 *
 *   npm run eval -w @everyword/eval                      # dev_clean
 *   npm run eval -w @everyword/eval -- --split test_other
 *
 * dev_clean is the controlled condition: studio-quality read speech from
 * the split the corpus itself labels "clean". test_other is the same
 * pipeline against the split LibriSpeech sets aside as harder, with
 * accents, noisier recordings and speakers who appear nowhere in the
 * clean split. One number says the renderer is capable; two say it
 * survives a condition we did not choose for ourselves.
 */
const SPLIT = (() => {
  const i = process.argv.indexOf("--split");
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  return value && /^[a-z_0-9]+$/.test(value) ? value : "dev_clean";
})();

const SCRATCH = path.join(
  process.env.TEMP ?? process.env.TMPDIR ?? "/tmp",
  "everyword-eval",
  SPLIT,
);
const REGION = process.env.AWS_REGION ?? "us-east-1";
/**
 * Staging bucket for the evaluation audio.
 *
 * The account suffix comes from the environment rather than the source,
 * for the same reason the sibling projects keep theirs out: an AWS account
 * id is not a password, but it is an identifier worth not publishing, and
 * hardcoding it also means nobody else can run this evaluation in their
 * own account.
 */
const BUCKET = `everyword-pipeline-${process.env.EVERYWORD_BUCKET_SUFFIX ?? ""}`;
const OFFSETS = [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400];
const PER_OFFSET = 5;
const SILENCE_SEC = 1.0;
const EARLY_TOLERANCE_MS = 150;
const PAUSE_GAP_SEC = 0.3;

interface GoldWord {
  word: string;
  start: number;
  end: number;
}
interface Utt {
  id: string;
  file: string;
  durationSec: number;
  offsetSec: number;
  words: GoldWord[];
}

const norm = (w: string): string => w.toUpperCase().replace(/[^A-Z']/g, "");

async function fetchRows(): Promise<Array<{ id: string; src: string; words: GoldWord[] }>> {
  const out: Array<{ id: string; src: string; words: GoldWord[] }> = [];
  for (const offset of OFFSETS) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=gilkeyio%2Flibrispeech-alignments&config=default&split=${SPLIT}&offset=${offset}&length=${PER_OFFSET}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`rows fetch ${offset}: HTTP ${res.status}`);
    const body = (await res.json()) as {
      rows: Array<{
        row: {
          id: string;
          audio: Array<{ src: string }>;
          words: GoldWord[];
        };
      }>;
    };
    for (const r of body.rows) {
      const src = r.row.audio?.[0]?.src;
      if (!src) continue;
      // Silence-labeled entries in the alignment use empty or <eps>-like tokens.
      const words = r.row.words.filter((w) => norm(w.word).length > 0);
      out.push({ id: r.row.id, src, words });
    }
  }
  return out;
}

function ffprobeDuration(file: string): number {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]).toString();
  return parseFloat(out.trim());
}

/** Decode-validate and normalize one utterance to 16k mono wav; false = unusable. */
function normalizeUtt(src: string, dst: string): boolean {
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-v", "error", "-i", src, "-ar", "16000", "-ac", "1", dst],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    return fs.existsSync(dst) && fs.statSync(dst).size > 1000;
  } catch {
    return false;
  }
}

async function prepareAudio(): Promise<{ utts: Utt[]; audioFile: string }> {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const manifestPath = path.join(SCRATCH, "manifest-v2.json");
  const audioFile = path.join(SCRATCH, "eval-audio-v2.mp3");
  if (fs.existsSync(manifestPath) && fs.existsSync(audioFile)) {
    console.log("Using cached stitched audio and manifest.");
    return { utts: JSON.parse(fs.readFileSync(manifestPath, "utf8")), audioFile };
  }

  console.log("Fetching utterances and gold alignments from Hugging Face...");
  const rows = await fetchRows();
  console.log(`Fetched ${rows.length} utterances.`);

  const utts: Utt[] = [];
  let dropped = 0;
  for (const [i, row] of rows.entries()) {
    const raw = path.join(SCRATCH, `utt-${String(i).padStart(3, "0")}.raw`);
    const file = path.join(SCRATCH, `norm-${String(i).padStart(3, "0")}.wav`);
    if (!fs.existsSync(file)) {
      // Download with one retry, then decode-validate via transcode. A
      // truncated or rate-limited body fails the decode and is retried
      // once; if it still fails, the utterance is dropped and counted.
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        const res = await fetch(row.src);
        if (res.ok) {
          fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
          ok = normalizeUtt(raw, file);
        }
        if (!ok) await new Promise((r) => setTimeout(r, 1500));
      }
      if (fs.existsSync(raw)) fs.rmSync(raw);
      if (!ok) {
        dropped++;
        continue;
      }
    }
    utts.push({
      id: row.id,
      file,
      durationSec: ffprobeDuration(file),
      offsetSec: 0,
      words: row.words,
    });
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`Validated ${utts.length} utterances, dropped ${dropped} undecodable.`);

  // Stitch with silences, tracking offsets.
  const silence = path.join(SCRATCH, "silence.wav");
  if (!fs.existsSync(silence)) {
    execFileSync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
      "-t", String(SILENCE_SEC), silence,
    ]);
  }
  const listPath = path.join(SCRATCH, "concat.txt");
  const lines: string[] = [];
  let cursor = 0;
  for (const u of utts) {
    u.offsetSec = cursor;
    lines.push(`file '${u.file.replace(/\\/g, "/")}'`);
    lines.push(`file '${silence.replace(/\\/g, "/")}'`);
    cursor += u.durationSec + SILENCE_SEC;
  }
  fs.writeFileSync(listPath, lines.join("\n"));
  execFileSync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", listPath,
    "-ar", "16000", "-ac", "1", "-b:a", "64k", audioFile,
  ]);
  fs.writeFileSync(manifestPath, JSON.stringify(utts, null, 1));
  console.log(`Stitched ${utts.length} utterances, ${Math.round(cursor)}s total.`);
  return { utts, audioFile };
}

async function transcribe(audioFile: string): Promise<TranscribeResult> {
  const cache = path.join(SCRATCH, "transcript-v2.json");
  if (fs.existsSync(cache)) {
    console.log("Using cached Transcribe result.");
    return JSON.parse(fs.readFileSync(cache, "utf8"));
  }
  const s3 = new S3Client({ region: REGION });
  const tr = new TranscribeClient({ region: REGION });
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch {
    /* exists */
  }
  const key = "eval/librispeech-eval.mp3";
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fs.readFileSync(audioFile) }),
  );
  const job = `everyword-lseval-${Date.now()}`;
  await tr.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: job,
      LanguageCode: "en-US",
      MediaFormat: "mp3",
      Media: { MediaFileUri: `s3://${BUCKET}/${key}` },
    }),
  );
  console.log(`Transcribe job ${job} started...`);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await tr.send(new GetTranscriptionJobCommand({ TranscriptionJobName: job }));
    const s = res.TranscriptionJob?.TranscriptionJobStatus;
    process.stdout.write(`\r  ${s}   `);
    if (s === "COMPLETED") {
      const uri = res.TranscriptionJob?.Transcript?.TranscriptFileUri;
      const body = (await (await fetch(uri!)).json()) as TranscribeResult;
      fs.writeFileSync(cache, JSON.stringify(body));
      console.log();
      return body;
    }
    if (s === "FAILED") throw new Error(res.TranscriptionJob?.FailureReason);
  }
  throw new Error("Transcribe timeout");
}

/** Minimal edit-distance alignment; returns index pairs of equal tokens. */
function alignTokens(ref: string[], hyp: string[]): Array<[number, number]> {
  const n = ref.length;
  const m = hyp.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i]![0] = i;
  for (let j = 0; j <= m; j++) dp[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      dp[i]![j] = Math.min(sub, dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (ref[i - 1] === hyp[j - 1] && dp[i]![j] === dp[i - 1]![j - 1]!) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      i--;
      j--;
    } else if (dp[i]![j] === dp[i - 1]![j]! + 1) i--;
    else j--;
  }
  return pairs.reverse();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

/** Naive baseline: greedy fixed-width packing that ignores timing. */
function naiveChunk(words: CaptionWord[], maxChars = 42): CaptionWord[][] {
  const out: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  let len = 0;
  for (const w of words) {
    const projected = len === 0 ? w.w.length : len + 1 + w.w.length;
    if (cur.length > 0 && projected > maxChars) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(w);
    len = len === 0 ? w.w.length : len + 1 + w.w.length;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/**
 * Share of internal line breaks that land on a real pause in GOLD timing.
 * Words are matched by value key (start:end:text), because the segmenter
 * tiles by cloning word objects and identity lookups would miss them.
 */
const wkey = (w: CaptionWord): string => `${w.s.toFixed(2)}:${w.w}`;
function breaksOnPauses(
  lines: CaptionWord[][],
  goldByKey: Map<string, { start: number; end: number }>,
): { breaks: number; onPause: number } {
  let breaks = 0;
  let onPause = 0;
  for (let li = 0; li < lines.length - 1; li++) {
    const lastWord = lines[li]![lines[li]!.length - 1]!;
    const nextWord = lines[li + 1]![0]!;
    const a = goldByKey.get(wkey(lastWord));
    const b = goldByKey.get(wkey(nextWord));
    if (!a || !b) continue; // only judge breaks where both sides matched gold
    breaks++;
    if (b.start - a.end >= PAUSE_GAP_SEC) onPause++;
  }
  return { breaks, onPause };
}

async function main(): Promise<void> {
  const { utts, audioFile } = await prepareAudio();
  const transcript = await transcribe(audioFile);
  const hypWords = transcribeItemsToWords(transcript);

  // Per-utterance alignment of hypothesis to gold.
  const onsetErrorsMs: number[] = [];
  const earlyMs: number[] = [];
  let matched = 0;
  let goldTotal = 0;
  const goldByKey = new Map<string, { start: number; end: number }>();

  for (const u of utts) {
    const lo = u.offsetSec - 0.5;
    const hi = u.offsetSec + u.durationSec + 0.5;
    const window: Array<[number, CaptionWord]> = [];
    hypWords.forEach((w, i) => {
      if (w.s >= lo && w.s <= hi) window.push([i, w]);
    });
    const refTokens = u.words.map((w) => norm(w.word));
    const hypTokens = window.map(([, w]) => norm(w.w));
    goldTotal += refTokens.length;
    for (const [ri, hjLocal] of alignTokens(refTokens, hypTokens)) {
      const [, hypWord] = window[hjLocal]!;
      const gold = u.words[ri]!;
      const goldGlobalStart = gold.start + u.offsetSec;
      const goldGlobalEnd = gold.end + u.offsetSec;
      matched++;
      goldByKey.set(wkey(hypWord), { start: goldGlobalStart, end: goldGlobalEnd });
      const deltaMs = (hypWord.s - goldGlobalStart) * 1000;
      onsetErrorsMs.push(Math.abs(deltaMs));
      if (deltaMs < 0) earlyMs.push(-deltaMs);
    }
  }

  onsetErrorsMs.sort((a, b) => a - b);
  earlyMs.sort((a, b) => a - b);
  const earlyBeyondTolerance = earlyMs.filter((e) => e > EARLY_TOLERANCE_MS).length;

  // Line quality: EveryWord segmenter vs naive fixed-width chunker,
  // both judged against GOLD pause structure.
  const ewSegments = segmentWords(hypWords).map((s) => s.words);
  const naiveSegments = naiveChunk(hypWords);
  const ew = breaksOnPauses(ewSegments, goldByKey);
  const nv = breaksOnPauses(naiveSegments, goldByKey);
  const doc = normalizeTranscribe(transcript);
  const overBudget = doc.segments.filter((s) => s.text.length > 42).length;

  const summary = {
    split: SPLIT,
    reference:
      `LibriSpeech ${SPLIT.replace("_", "-")} with Montreal Forced Aligner gold word alignments (HF gilkeyio/librispeech-alignments); audio and alignments not authored by us`,
    utterances: utts.length,
    speakersApprox: new Set(utts.map((u) => u.id.split("-")[0])).size,
    goldWords: goldTotal,
    matchedWords: matched,
    matchRatePercent: Math.round((matched / goldTotal) * 1000) / 10,
    highlightOnset: {
      medianAbsMs: Math.round(percentile(onsetErrorsMs, 50)),
      p90AbsMs: Math.round(percentile(onsetErrorsMs, 90)),
    },
    negativeControl: {
      earlyToleranceMs: EARLY_TOLERANCE_MS,
      wordsLitEarlyBeyondTolerance: earlyBeyondTolerance,
      ofMatchedWords: matched,
    },
    lineBreaksOnRealPauses: {
      everyword: { breaks: ew.breaks, onPausePercent: Math.round((ew.onPause / Math.max(1, ew.breaks)) * 1000) / 10 },
      naiveFixedWidth: { breaks: nv.breaks, onPausePercent: Math.round((nv.onPause / Math.max(1, nv.breaks)) * 1000) / 10 },
    },
    linesOver42Chars: overBudget,
  };

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(summary, null, 2));
  const outDir = path.resolve(process.cwd(), "results");
  fs.mkdirSync(outDir, { recursive: true });
  // dev_clean keeps the historical filename so every existing reference to
  // it stays valid; any other split gets its own file beside it. Without
  // this, a run on a second split silently overwrote the first, which is
  // exactly what happened the first time this was parameterised.
  const name = SPLIT === "dev_clean" ? "librispeech.json" : `librispeech-${SPLIT.replace(/_/g, "-")}.json`;
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(summary, null, 1));
  console.log(`\nWrote results/${name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
