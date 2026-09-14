import { createHash } from "node:crypto";
import * as fs from "node:fs";
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
  countWords,
  docDuration,
  normalizeTranscribe,
  type TranscribeResult,
} from "@everyword/captions-core";

/**
 * EveryWord caption pipeline (documented in docs/AWS.md):
 * media in, word-timed captions out.
 *
 *   npm run pipeline -- --input <url or file> --name aesop-014 \
 *     --title "The Title" --attribution "LibriVox, public domain"
 *
 * Steps: fetch media, upload to the pipeline S3 bucket, run an Amazon
 * Transcribe job (word-level timestamps are part of every result), poll,
 * normalize with @everyword/captions-core (segmentation, clause-aware
 * breaks, gap tiling), then write media + captions + manifest entry into
 * the web app's public content directory so the reader can play it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION ?? "us-east-1";
const CONTENT_DIR = path.resolve(here, "../../web/public/content");

interface Args {
  input: string;
  name: string;
  title: string;
  attribution: string;
  language: string;
  bucket?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(`--${flag}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const input = get("input");
  const name = get("name");
  if (!input || !name || !/^[a-z0-9-]+$/.test(name)) {
    console.error(
      "Usage: npm run pipeline -- --input <url|file> --name <slug> [--title t] [--attribution a] [--language en-US]",
    );
    process.exit(1);
  }
  const args: Args = {
    input,
    name,
    title: get("title") ?? name,
    attribution: get("attribution") ?? "",
    language: get("language") ?? "en-US",
  };
  const bucket = get("bucket");
  if (bucket) args.bucket = bucket;
  return args;
}

async function fetchMedia(input: string): Promise<{ bytes: Buffer; ext: string }> {
  if (/^https?:\/\//.test(input)) {
    console.log(`Downloading ${input}`);
    const res = await fetch(input);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(input).pathname).slice(1) || "mp3";
    return { bytes, ext };
  }
  const bytes = fs.readFileSync(input);
  return { bytes, ext: path.extname(input).slice(1) || "mp3" };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const s3 = new S3Client({ region: REGION });
  const transcribe = new TranscribeClient({ region: REGION });

  const { bytes, ext } = await fetchMedia(args.input);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  console.log(`Media: ${bytes.length} bytes, .${ext}, sha ${hash}`);

  const accountSuffix = process.env.EVERYWORD_BUCKET_SUFFIX ?? "957325809861";
  const bucket = args.bucket ?? `everyword-pipeline-${accountSuffix}`;
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created bucket ${bucket}`);
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(name)) throw err;
  }

  const key = `raw/${args.name}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes }));
  console.log(`Uploaded s3://${bucket}/${key}`);

  const jobName = `everyword-${args.name}-${hash}-${Date.now()}`;
  await transcribe.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: args.language as LanguageCode,
      MediaFormat: ext === "m4a" ? "mp4" : (ext as "mp3" | "mp4" | "wav" | "flac"),
      Media: { MediaFileUri: `s3://${bucket}/${key}` },
    }),
  );
  console.log(`Transcribe job ${jobName} started`);

  let transcriptUri: string | undefined;
  for (let i = 0; i < 90; i++) {
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
    if (status === "FAILED") {
      throw new Error(`Transcribe failed: ${job?.FailureReason}`);
    }
  }
  console.log();
  if (!transcriptUri) throw new Error("Transcribe job did not complete in time");

  const transcriptRes = await fetch(transcriptUri);
  const transcript = (await transcriptRes.json()) as TranscribeResult;
  const doc = normalizeTranscribe(transcript, { language: args.language.slice(0, 2) });

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const mediaOut = path.join(CONTENT_DIR, `${args.name}.${ext}`);
  const captionsOut = path.join(CONTENT_DIR, `${args.name}.captions.json`);
  fs.writeFileSync(mediaOut, bytes);
  fs.writeFileSync(captionsOut, JSON.stringify(doc, null, 1));

  // Manifest: what the reader app lists, with license provenance.
  const manifestPath = path.join(CONTENT_DIR, "manifest.json");
  const manifest: {
    items: Array<Record<string, unknown>>;
  } = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : { items: [] };
  manifest.items = manifest.items.filter((i) => i.slug !== args.name);
  manifest.items.push({
    slug: args.name,
    title: args.title,
    attribution: args.attribution,
    media: `${args.name}.${ext}`,
    captions: `${args.name}.captions.json`,
    words: countWords(doc),
    durationSec: Math.round(docDuration(doc)),
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

  console.log(`Captions: ${doc.segments.length} segments, ${countWords(doc)} words, ${Math.round(docDuration(doc))}s`);
  console.log(`Wrote ${captionsOut}`);
  console.log(`Wrote ${mediaOut}`);
  console.log(`Manifest updated: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
