# AWS Integrations

Documented-integrations record for the AWS Builder mini challenge. Every service below is called from code in this repository.

## Amazon Transcribe (the load-bearing service)

- Where: `apps/pipeline/src/transcribe.ts` (production caption generation) and `apps/eval/src/run-librispeech.ts` (the external timing evaluation).
- What for: word-level timestamps are the entire mechanism of EveryWord. The pipeline uploads media to S3, runs a Transcribe job, and `@everyword/captions-core` normalizes the word items into the open caption format (42-character lines, clause-aware breaks, sub-perceptual gap tiling).
- Measured, not assumed: against gold LibriSpeech forced alignments (27 speakers, 788 words we did not record), the end-to-end highlight lands at 30 ms median onset error, p90 85 ms, with 0 of 766 matched words lighting early beyond 150 ms. Method and limits in `docs/EVAL.md`; committed run in `apps/eval/results/librispeech.json`.
- Cost posture: batch jobs at roughly 2.4 cents per audio minute; the whole evaluation cost under a dollar.

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
