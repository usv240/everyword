import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PollyClient,
  SynthesizeSpeechCommand,
  type Engine,
  type VoiceId,
} from "@aws-sdk/client-polly";
import {
  countWords,
  docDuration,
  segmentWords,
  type CaptionDoc,
  type CaptionWord,
} from "@everyword/captions-core";

/**
 * The text pipeline: any text becomes a perfect read-along.
 *
 *   npm run polly -- --input story.txt --name tortoise \
 *     --title "The Tortoise and the Hare" --attribution "Aesop, public domain"
 *
 * Why this exists alongside the Transcribe pipeline: Amazon Polly returns
 * speech marks, per-word timings for the speech it is about to produce,
 * each carrying byte offsets into the source text. That means the words
 * are not recognized, they are known. Where the Transcribe path measures
 * 30 ms median onset error and a 97.2 percent word match against gold
 * alignments (docs/EVAL.md), this path has zero word error by
 * construction and timings straight from the synthesizer, so punctuation,
 * proper nouns, and numbers are exactly as the author wrote them.
 *
 * The consequence is the product one: every public-domain book ever
 * written can become a word-lit read-along, which is how a reading tool
 * gets a library instead of a demo.
 *
 * Both pipelines converge on the same open caption format and the same
 * segmentation engine (42-character lines, clause-aware breaks, gap
 * tiling), so the renderer cannot tell them apart.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(here, "../../web/public/content");
const REGION = process.env.AWS_REGION ?? "us-east-1";
/** Polly's per-request character budget; we stay well under it. */
const CHUNK_CHARS = 2800;

interface PollyMark {
  time: number;
  type: string;
  start: number;
  end: number;
  value: string;
}

/** Split text into synthesis chunks at sentence boundaries, tracking offsets. */
export function chunkText(text: string, maxChars = CHUNK_CHARS): Array<{ text: string; offset: number }> {
  const chunks: Array<{ text: string; offset: number }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text.length - cursor <= maxChars) {
      chunks.push({ text: text.slice(cursor), offset: cursor });
      break;
    }
    const window = text.slice(cursor, cursor + maxChars);
    // Prefer a sentence end, then any newline, then a space.
    const sentence = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf(".\n"),
    );
    const cut =
      sentence > maxChars * 0.4
        ? sentence + 1
        : Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const end = cut > 0 ? cut : maxChars;
    chunks.push({ text: text.slice(cursor, cursor + end), offset: cursor });
    cursor += end;
  }
  return chunks;
}

/**
 * Turn Polly marks into display words by slicing the SOURCE text with the
 * byte offsets Polly provides. Slicing rather than using mark.value is
 * what recovers punctuation ("river." not "river"), so the reader sees
 * the author's text, not a normalized token stream.
 */
export function marksToWords(
  marks: PollyMark[],
  sourceText: string,
  timeOffsetMs: number,
  textOffset: number,
  chunkDurationSec: number,
): CaptionWord[] {
  const words: CaptionWord[] = [];
  let consumedTo = textOffset;
  for (const [i, m] of marks.entries()) {
    const raw = sourceText.slice(textOffset + m.start, textOffset + m.end);
    // Polly's marks cover the spoken token only, so punctuation attached to
    // the word is outside them. Extend left through opening marks and right
    // through closing ones, never re-consuming a previous word's characters,
    // so the reader sees the author's text: "Wait a bit," not Wait a bit.
    let start = textOffset + m.start;
    while (start > consumedTo && /["'(\[‘“]/.test(sourceText[start - 1]!)) start--;
    let end = textOffset + m.end;
    while (end < sourceText.length && /[.,;:!?"')\]’”]/.test(sourceText[end]!)) end++;
    consumedTo = end;
    const display = sourceText.slice(start, end).trim() || raw;
    const s = (timeOffsetMs + m.time) / 1000;
    const nextMark = marks[i + 1];
    const e = nextMark
      ? (timeOffsetMs + nextMark.time) / 1000
      : timeOffsetMs / 1000 + chunkDurationSec;
    words.push({ w: display, s: Number(s.toFixed(3)), e: Number(Math.max(s, e).toFixed(3)) });
  }
  return words;
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

function arg(flag: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

async function main(): Promise<void> {
  const inputPath = arg("input");
  const name = arg("name");
  if (!inputPath || !name || !/^[a-z0-9-]+$/.test(name)) {
    console.error(
      "Usage: npm run polly -- --input <text file> --name <slug> [--title t] [--attribution a] [--voice Joanna] [--engine neural]",
    );
    process.exit(1);
  }
  const title = arg("title", name)!;
  const attribution = arg("attribution", "")!;
  const voice = (arg("voice", "Joanna") as VoiceId)!;
  const engine = (arg("engine", "neural") as Engine)!;

  // Polly's generative engine, its most natural sounding, does not support
  // word speech marks, which is the entire mechanism here. Fail fast with
  // the reason rather than after a synthesis charge. See FRICTION_LOG.md
  // entry 7: read-along is exactly the use case that wants the best voice.
  if (engine === "generative") {
    console.error(
      "Polly's generative engine does not support word speech marks, which EveryWord requires.\n" +
        "Use --engine neural (Joanna, Matthew, Ivy, Kimberly, Kendra) or --engine standard.",
    );
    process.exit(1);
  }

  const sourceText = fs
    .readFileSync(inputPath, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const chunks = chunkText(sourceText);
  console.log(`${sourceText.length} characters in ${chunks.length} synthesis chunk(s), voice ${voice}`);

  const polly = new PollyClient({ region: REGION });
  const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP ?? "/tmp", "everyword-polly-"));
  const audioParts: string[] = [];
  const allWords: CaptionWord[] = [];
  let timeOffsetMs = 0;

  for (const [i, chunk] of chunks.entries()) {
    const audioRes = await polly.send(
      new SynthesizeSpeechCommand({
        Text: chunk.text,
        VoiceId: voice,
        Engine: engine,
        OutputFormat: "mp3",
      }),
    );
    const audioFile = path.join(tmpDir, `part-${i}.mp3`);
    fs.writeFileSync(audioFile, Buffer.from(await audioRes.AudioStream!.transformToByteArray()));
    audioParts.push(audioFile);

    const markRes = await polly.send(
      new SynthesizeSpeechCommand({
        Text: chunk.text,
        VoiceId: voice,
        Engine: engine,
        OutputFormat: "json",
        SpeechMarkTypes: ["word"],
      }),
    );
    const marks: PollyMark[] = (await markRes.AudioStream!.transformToString())
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as PollyMark);

    const durationSec = ffprobeDuration(audioFile);
    allWords.push(...marksToWords(marks, sourceText, timeOffsetMs, chunk.offset, durationSec));
    timeOffsetMs += durationSec * 1000;
    console.log(`  chunk ${i + 1}/${chunks.length}: ${marks.length} words, ${durationSec.toFixed(1)}s`);
  }

  // Concatenate parts into one file (single chunk copies straight through).
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const mediaOut = path.join(CONTENT_DIR, `${name}.mp3`);
  if (audioParts.length === 1) {
    fs.copyFileSync(audioParts[0]!, mediaOut);
  } else {
    const listFile = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(listFile, audioParts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", mediaOut]);
  }

  const doc: CaptionDoc = {
    version: "1.0",
    language: "en",
    source: { kind: "polly", generatedAt: new Date().toISOString(), model: `${voice}/${engine}` },
    segments: segmentWords(allWords),
  };
  fs.writeFileSync(path.join(CONTENT_DIR, `${name}.captions.json`), JSON.stringify(doc, null, 1));

  const manifestPath = path.join(CONTENT_DIR, "manifest.json");
  const manifest: { items: Array<Record<string, unknown>> } = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : { items: [] };
  manifest.items = manifest.items.filter((i) => i.slug !== name);
  manifest.items.push({
    slug: name,
    title,
    attribution,
    media: `${name}.mp3`,
    captions: `${name}.captions.json`,
    words: countWords(doc),
    durationSec: Math.round(docDuration(doc)),
    source: "polly",
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(
    `\n${title}: ${doc.segments.length} segments, ${countWords(doc)} words, ${Math.round(docDuration(doc))}s`,
  );
  console.log("Zero word error by construction: the text was known, not recognized.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
