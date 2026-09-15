# Product Feedback

Draft of the hackathon submission's product-feedback answer, maintained as we build so it reflects real experience. Format per the rules: what we used it for, what worked well, what needs work, how onboarding felt, whether we would build with it again.

## React Native for TV (react-native-tvos) and the Fire TV toolchain

- Used for: the EveryWord TV app: D-pad-driven karaoke reader sharing the renderer package with the web app.
- Worked well: the template ships genuinely TV-ready (LEANBACK_LAUNCHER present, focus engine works with plain Pressable); the shared-package model held once Metro was configured; the app ran on the Android TV emulator on first successful build.
- Needs work: the Windows path is rough for exactly the people a hackathon invites. Three separate failures cost most of a day: ninja MAX_PATH under a normal-length project folder, Metro versus subst-drive file identity, and monorepo duplicate React (FRICTION_LOG.md entries 3 to 5, each with the workaround).
- Onboarding: one command scaffolds a working TV project; the gap is a Windows caveats page.
- Build again: yes, with the friction log taped to the monitor.

## Amazon Transcribe

- Used for: every word timing in the product: the caption pipeline and the LibriSpeech evaluation.
- Worked well: word-level timestamps are simply part of every result; measured against gold forced alignments our end-to-end highlight lands at 30 ms median onset error with zero early-lights beyond 150 ms across 766 matched words (docs/EVAL.md). That number is Transcribe's timing quality wearing our renderer.
- Needs work: a synchronous small-file mode would remove the poll loop (FRICTION_LOG.md entry 2); sung or overlapping speech degrades timing, which shaped our dialogue-forward catalog policy.
- Onboarding: S3 in, JSON out, no tuning needed for read speech.
- Build again: yes; it is the load-bearing service of the project.

## AWS CDK, S3, CloudFront

- Used for: the reader's static hosting, deployed from one TypeScript file; the pipeline bucket.
- Worked well: bootstrap-then-deploy worked first try; origin access control and the index-rewrite function pattern are clean.
- Needs work: nothing significant at this scale.
- Build again: yes.

## Hugging Face datasets-server (evaluation infrastructure, third-party)

- Used for: fetching LibriSpeech utterances and gold alignments for the external evaluation.
- Worked well: rows API serves alignments and audio without downloading 300MB parquets.
- Needs work: truncated audio bodies arrive as HTTP 200 and silently poison downstream numbers; decode-validation on every file fixed it (FRICTION_LOG.md entry 6).

## Sections to complete before submission

- Fire TV or Vega simulator/device experience for the final demo footage
- Amazon Appstore submission flow, once attempted
