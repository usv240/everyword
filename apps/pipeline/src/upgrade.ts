/**
 * Upgrade a video's existing subtitles to word level.
 *
 *   npm run upgrade -- \
 *     --video sintel.mp4 --subtitles sintel.en.srt \
 *     --name sintel --title "Sintel" \
 *     --attribution "Blender Foundation, CC BY 3.0"
 *
 * This is the path that makes EveryWord a product rather than a library
 * of five things we made. Every video in the world already has subtitles
 * and every one of them is line level: good enough to tell you what was
 * said, useless for telling you which word is being said now. That gap is
 * the entire reason nobody has shipped Same Language Subtitling for
 * video, and closing it needs no new content at all.
 *
 * What it does
 * ------------
 * Pulls the audio out of the video, sends only that to Amazon Transcribe,
 * then aligns what the recogniser heard against the subtitle file that
 * came with the video. The subtitle file supplies the words; Transcribe
 * supplies the timings; `upgradeSubtitles` in @everyword/captions-core
 * does the alignment and holds the guarantees.
 *
 * Audio only, on purpose
 * ----------------------
 * Transcribe accepts mp4 directly, and uploading a 270 MB film to
 * transcribe six minutes of dialogue is a waste of somebody's bandwidth
 * and somebody's money. The audio track of that same film is a few
 * megabytes. Nothing about the result changes.
 *
 * What this will not do
 * ---------------------
 * Invent a subtitle file. If a video has no captions, the Transcribe
 * pipeline in `transcribe.ts` will recognise it from scratch, and that
 * output carries recogniser errors into what a child reads. This command
 * exists precisely because that tradeoff is avoidable when captions
 * already exist, so it refuses to quietly fall back to it.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
  type LanguageCode,
} from "@aws-sdk/client-transcribe";

import {
  anchorRate,
  countWords,
  docDuration,
  parseSubtitles,
  subtitleSpan,
  toWebVTT,
  upgradeSubtitles,
  type RecognisedWord,
  type TranscribeResult,
} from "@everyword/captions-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION ?? "us-east-1";
const CONTENT_DIR = path.resolve(here, "../../web/public/content");

interface Args {
  video: string;
  subtitles: string;
  name: string;
  title: string;
  attribution: string;
  language: string;
  bucket?: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith("--") && value !== undefined) out[key.slice(2)] = value;
  }
  for (const required of ["video", "subtitles", "name", "title", "attribution"]) {
    if (!out[required]) {
      throw new Error(
        `--${required} is required.\n\n` +
          "  npm run upgrade -- --video film.mp4 --subtitles film.en.srt \\\n" +
          '    --name film --title "Film" --attribution "Studio, CC BY 4.0"',
      );
    }
  }
  return {
    video: out.video!,
    subtitles: out.subtitles!,
    name: out.name!,
    title: out.title!,
    attribution: out.attribution!,
    language: out.language ?? "en-US",
    bucket: out.bucket,
  };
}

function ffmpeg(args: string[]): void {
  const proc = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (proc.error) {
    throw new Error(
      "ffmpeg is not on PATH. It is needed to take the audio out of the video.",
    );
  }
  if (proc.status !== 0) {
    throw new Error(`ffmpeg failed:\n${(proc.stderr ?? "").slice(-1200)}`);
  }
}

function mediaSeconds(file: string): number {
  const proc = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  const value = Number.parseFloat((proc.stdout ?? "").trim());
  return Number.isFinite(value) ? value : 0;
}

/** Transcribe's transcript shape, flattened to what the aligner wants. */
function recognisedWords(transcript: TranscribeResult): RecognisedWord[] {
  const items = transcript.results?.items ?? [];
  const words: RecognisedWord[] = [];
  for (const item of items) {
    if (item.type !== "pronunciation") continue;
    const text = item.alternatives?.[0]?.content;
    if (!text) continue;
    // Confidence is deliberately not carried through. The aligner does
    // not weight by it, because a low-confidence word that matches the
    // subtitle text is exactly as good an anchor as a confident one: the
    // subtitle already told us the word is right.
    words.push({
      w: text,
      s: Number.parseFloat(item.start_time ?? "0"),
      e: Number.parseFloat(item.end_time ?? "0"),
    });
  }
  return words;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.video)) throw new Error(`No video at ${args.video}`);
  if (!fs.existsSync(args.subtitles)) {
    throw new Error(`No subtitle file at ${args.subtitles}`);
  }

  const cues = parseSubtitles(fs.readFileSync(args.subtitles, "utf8"));
  if (cues.length === 0) {
    throw new Error(
      `${args.subtitles} parsed to zero cues. It may not be SubRip or WebVTT, ` +
        "or it may be a subtitle image track rather than text.",
    );
  }
  const span = subtitleSpan(cues);
  const videoSeconds = mediaSeconds(args.video);
  console.log(
    `Subtitles: ${cues.length} cues, covering ${span.start.toFixed(1)}s to ${span.end.toFixed(1)}s`,
  );
  console.log(`Video: ${videoSeconds.toFixed(1)}s`);
  if (videoSeconds > 0 && span.end > videoSeconds + 30) {
    // Cheap check, caught before paying for a recognition pass: subtitle
    // files get paired with the wrong cut of a film all the time, and the
    // symptom is captions that drift further out the longer you watch.
    throw new Error(
      `The subtitles run ${(span.end - videoSeconds).toFixed(0)}s past the end of ` +
        "the video. That is usually the wrong subtitle file for this cut.",
    );
  }

  // ---- audio out, so only the audio is uploaded ------------------------
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "everyword-"));
  const audio = path.join(tmp, `${args.name}.mp3`);
  console.log("Extracting audio ...");
  ffmpeg(["-y", "-v", "error", "-i", args.video, "-vn",
          "-ac", "1", "-ar", "16000", "-b:a", "64k", audio]);
  const audioBytes = fs.readFileSync(audio);
  const videoBytes = fs.readFileSync(args.video);
  console.log(
    `  audio ${(audioBytes.length / 1048576).toFixed(1)} MB ` +
      `from a ${(videoBytes.length / 1048576).toFixed(1)} MB video`,
  );

  // ---- recognise -------------------------------------------------------
  const accountSuffix = process.env.EVERYWORD_BUCKET_SUFFIX;
  if (!accountSuffix) {
    throw new Error(
      "EVERYWORD_BUCKET_SUFFIX is not set. It is your AWS account id, used to " +
        "name the staging bucket. See docs/AWS.md.",
    );
  }
  const bucket = args.bucket ?? `everyword-pipeline-${accountSuffix}`;
  const s3 = new S3Client({ region: REGION });
  const transcribe = new TranscribeClient({ region: REGION });

  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created bucket ${bucket}`);
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(name)) throw err;
  }

  const hash = createHash("sha256").update(audioBytes).digest("hex").slice(0, 8);
  const key = `raw/${args.name}-${hash}.mp3`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: audioBytes }));
  console.log(`Uploaded s3://${bucket}/${key}`);

  const jobName = `everyword-upgrade-${args.name}-${hash}-${Date.now()}`;
  await transcribe.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: args.language as LanguageCode,
      MediaFormat: "mp3",
      Media: { MediaFileUri: `s3://${bucket}/${key}` },
    }),
  );
  console.log(`Transcribe job ${jobName} started`);

  let transcriptUri: string | undefined;
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await transcribe.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
    );
    const job = res.TranscriptionJob;
    const status = job?.TranscriptionJobStatus;
    process.stdout.write(`\r  status: ${status}   `);
    if (status === "COMPLETED") {
      transcriptUri = job?.Transcript?.TranscriptFileUri;
      break;
    }
    if (status === "FAILED") throw new Error(`Transcribe failed: ${job?.FailureReason}`);
  }
  console.log();
  if (!transcriptUri) throw new Error("Transcribe job did not complete in time");

  const transcript = (await (await fetch(transcriptUri)).json()) as TranscribeResult;
  const heard = recognisedWords(transcript);
  console.log(`Recogniser heard ${heard.length} words`);

  // Keep what the recogniser said, beside what it was aligned against.
  // Alignment quality is the one thing in this pipeline that can be
  // quietly poor, and without the raw pass there is no way to tell a bad
  // recognition from a bad alignment from a subtitle file on the wrong
  // clock. It is a few kilobytes.
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CONTENT_DIR, `${args.name}.recognised.json`),
    JSON.stringify({ words: heard }, null, 1),
  );

  // ---- align -----------------------------------------------------------
  const language = args.language.slice(0, 2);
  const doc = upgradeSubtitles(cues, heard, { language });
  const anchors = anchorRate(cues, heard);
  console.log(
    `Aligned ${anchors.words} subtitle words, ` +
      `${anchors.anchored} anchored to a recognised word ` +
      `(${(anchors.rate * 100).toFixed(1)} percent)`,
  );
  if (anchors.rate < 0.5) {
    // Not fatal. The words are still the author's and still inside their
    // own lines; more of the timing is simply interpolated, and whoever
    // ships this to readers deserves to be told rather than to find out.
    console.warn(
      "  Under half the words anchored. The captions are still correct text " +
        "in the right lines, but much of the word timing is interpolation. " +
        "Check the audio language matches --language.",
    );
  }

  // ---- write -----------------------------------------------------------
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const ext = path.extname(args.video).slice(1).toLowerCase() || "mp4";
  const mediaName = `${args.name}.${ext}`;
  fs.writeFileSync(path.join(CONTENT_DIR, mediaName), videoBytes);
  fs.writeFileSync(
    path.join(CONTENT_DIR, `${args.name}.captions.json`),
    JSON.stringify(doc, null, 1),
  );
  fs.writeFileSync(path.join(CONTENT_DIR, `${args.name}.vtt`), toWebVTT(doc));
  fs.writeFileSync(
    path.join(CONTENT_DIR, `${args.name}.karaoke.vtt`),
    toWebVTT(doc, { karaoke: true }),
  );
  // The subtitle file we were given, kept beside the result. Anyone
  // should be able to see what went in as well as what came out, and
  // diff the two if they doubt that the words are unchanged.
  fs.copyFileSync(args.subtitles, path.join(CONTENT_DIR, `${args.name}.source.srt`));

  const manifestPath = path.join(CONTENT_DIR, "manifest.json");
  const manifest: { items: Array<Record<string, unknown>> } = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : { items: [] };
  manifest.items = manifest.items.filter((i) => i.slug !== args.name);
  manifest.items.push({
    slug: args.name,
    title: args.title,
    attribution: args.attribution,
    media: mediaName,
    captions: `${args.name}.captions.json`,
    kind: "video",
    words: countWords(doc),
    durationSec: Math.round(docDuration(doc)),
    source: "aligned",
    sourceSubtitles: `${args.name}.source.srt`,
    anchoredRate: Math.round(anchors.rate * 1000) / 1000,
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(
    `\nCaptions: ${doc.segments.length} lines, ${countWords(doc)} words, ` +
      `${Math.round(docDuration(doc))}s`,
  );
  console.log(`Wrote ${path.join(CONTENT_DIR, mediaName)}`);
  console.log("The displayed words are the subtitle author's, unchanged.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
