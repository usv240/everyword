# AWS Integrations

Documented-integrations record for the AWS Builder mini challenge. Every service below is called from code in this repository.

## Amazon Transcribe (the load-bearing service)

- Where: `apps/pipeline/src/transcribe.ts` (production caption generation) and `apps/eval/src/run-librispeech.ts` (the external timing evaluation).
- What for: word-level timestamps are the entire mechanism of EveryWord. The pipeline uploads media to S3, runs a Transcribe job, and `@everyword/captions-core` normalizes the word items into the open caption format (42-character lines, clause-aware breaks, sub-perceptual gap tiling).
- Measured, not assumed: against gold LibriSpeech forced alignments (27 speakers, 788 words we did not record), the end-to-end highlight lands at 30 ms median onset error, p90 85 ms, with 0 of 766 matched words lighting early beyond 150 ms. Method and limits in `docs/EVAL.md`; committed run in `apps/eval/results/librispeech.json`.
- Cost posture: batch jobs at roughly 2.4 cents per audio minute; the whole evaluation cost under a dollar.


## Amazon Polly (the text pipeline)

- Where: `apps/pipeline/src/polly.ts`
- What for: turning any public-domain text into a word-perfect read-along. Polly returns **speech marks**: per-word timings for the speech it is about to synthesize, each carrying byte offsets into the source text. The words are therefore known rather than recognized, so these captions have zero word error by construction and reproduce the author's punctuation exactly.
- Why it matters to the product: it is how a reading tool gets a library instead of a demo. Four of the five stories in the reader were generated this way from Project Gutenberg text, each with a different neural voice, for a few cents.
- Both pipelines converge on the same open caption format and the same segmentation engine, so the renderer cannot tell them apart.
- Two real limitations found and filed: the generative engine does not support word speech marks (FRICTION_LOG.md entry 7), and marks exclude attached punctuation, which the byte offsets let us recover (entry 8).

## Amazon S3

- Where: `apps/pipeline/src/transcribe.ts`, `apps/eval/src/run-librispeech.ts`, `infra/bin/app.ts`.
- What for: pipeline media staging (`everyword-pipeline-*` bucket, created on first use by code) and the private site bucket behind CloudFront.

## Amazon CloudFront + AWS CDK

- Where: `infra/bin/app.ts`.
- What for: the reader is a static export served from a private S3 bucket through CloudFront with origin access control and a viewer-request function that rewrites extensionless paths to directory indexes. The entire stack is one reviewable TypeScript file; `cdk deploy` reproduces the deployment. Live: https://d34emfdcezeszz.cloudfront.net

## Reproduce

```
npm install
npm run pipeline -- --input <url|file> --name my-story ...   # Transcribe pipeline
npm run librispeech -w @everyword/eval                       # the external evaluation
cd infra && npx cdk deploy                                   # the site
```

## Amazon Devices Builder Tools (MCP server)

- Where: evaluated and used during development; findings and feedback in `docs/BUILDER_TOOLS.md`.
- What for: Vega OS documentation search and retrieval. It surfaced the Vega caption-rendering workflow document, which established that the platform caption path (KeplerCaptionsView plus W3C VTTCue) carries one start and end time per cue and therefore cannot render word-level highlighting. That validated EveryWord shipping its own renderer, and produced our clearest platform feature request.
- It also prompted the WebVTT interop work: EveryWord now exports standard WebVTT in plain and karaoke (inline timestamp tag) forms alongside its own format.
- Three reproducible issues filed as friction log entries 9 to 11.
