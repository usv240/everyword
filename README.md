# EveryWord

Subtitles that light up word by word as they are spoken. Watching becomes reading. Measured against gold LibriSpeech alignments (speech we did not record): the highlight lands within 30 ms of the spoken word (median, p90 85 ms), never lights a word early beyond 150 ms across 766 matched words, and breaks lines at real pauses 42 percent of the time where timing-blind chunking manages 2 (docs/EVAL.md).

Run again on **test-other**, the split LibriSpeech itself sets aside as hard, with accents, noisier recordings and 26 speakers who appear nowhere in the clean split: the median onset error is the same 30 ms, the p90 the same 85 ms, and it still lights **zero** words early across 761 matched words. Match rate slips from 97.2 to 96.7 percent, which is the direction a harder split predicts and is stated rather than rounded away.

Same Language Subtitling (SLS), karaoke-style same-language captions on ordinary entertainment, is one of the most proven literacy interventions ever measured: two decades on Indian national television, 10 programmes reaching an estimated 200 million viewers, and Indian national broadcast policy since 2019. A five-year study of 13,000 people who could initially read little or nothing found 32 percentage points more children becoming good readers than in the unexposed group, at a cost of $0.004 per learner (UNESCO Institute for Lifelong Learning). Separately, more than 100 empirical studies find captions improve comprehension, attention and memory, with people learning to read among those who gain most (Gernsbacher, 2015). Sources for every claim are in [docs/EVIDENCE.md](docs/EVIDENCE.md). Amazon already ships exactly this mechanic for books (Immersion Reading and Read and Listen). No TV platform has ever shipped it for video. EveryWord is that product: Immersion Reading, for television.

Built for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track, plus the AWS Builder and Open Source mini challenges).

## Live

- Reader: https://d34emfdcezeszz.cloudfront.net (real content, press Play)
- Fire TV APK: https://github.com/usv240/everyword/releases/tag/v0.1.0 (self-contained, sideloads to a Fire TV device with `adb install`; the release carries sideload instructions and 58s of footage from an Android Virtual Device). Target platform, test environment and its limits: [docs/FIRE_TV_TARGET.md](docs/FIRE_TV_TARGET.md)
- MCP server (the Alexa+ surface): `https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp` (Model Context Protocol 2025-11-25 over Streamable HTTP, live)
- Deployed by the CDK stack in `infra/` (S3 and CloudFront for the reader, Lambda for the MCP server); the caption pipeline runs on Amazon Transcribe and Amazon Polly

## What is here

- `packages/captions-core`: the EveryWord caption format (docs/FORMAT.md), a standard **WebVTT exporter** (plain and karaoke, so our format is a superset rather than a silo), and the engine: an Amazon Transcribe normalizer with 42-character lines, clause-aware line breaks, and gap tiling so highlighting never flickers, plus the pure binary-search word-index math that drives the karaoke cursor. Fully unit tested.
- `packages/karaoke-captions-react`: the renderer, MIT licensed and published on npm as [`karaoke-captions-react`](https://www.npmjs.com/package/karaoke-captions-react). Its only dependency is [`@everyword/captions-core`](https://www.npmjs.com/package/@everyword/captions-core), also published and also MIT, so neither needs the application code around them. Feed it a caption document and a `time` in seconds; theme it with four CSS variables. The web reader and the Fire TV app share it.
- `apps/pipeline`: two ways in, one caption format out. **Transcribe pipeline**: human-narrated media in, word timings measured at 30 ms median. **Polly pipeline**: any text in, narrated and timed from speech marks, with zero word error by construction because the words are known rather than recognized. The second is how any public-domain book becomes a read-along. Uploads to S3, runs Amazon Transcribe (word-level timestamps), normalizes, and drops media plus captions plus a manifest entry into the reader's content directory.
- `apps/mcp`: the **MCP server**, the Alexa+ surface, with reading sessions persisted in DynamoDB as an append-only log from which every reported figure is derived. Model Context Protocol spec 2025-11-25 over Streamable HTTP with six tools: `list_library`, `recommend_story`, `get_reading_progress`, `record_reading_session`, `get_story_text`, and `explain_word`, which explains a word a reader is stuck on through a three-model Bedrock ladder, grounded in the sentence it appears in, and refuses words that are not in the story rather than guessing. Nothing fails into silence: the catalogue load retries and falls back to a bundled copy, the model ladder falls to the reader's own sentence, and `GET /api/resilience` reports every path. Thirty-six conformance and behaviour tests. It is a second independent consumer of `captions-core`: word counts and durations are computed from the caption documents rather than trusted from the manifest, so the numbers an agent reports are the numbers the karaoke cursor is driven by.
- `apps/agent`: a Strands agent on Amazon Bedrock that consumes the MCP server as an outside client, which is the cheapest proof the surface is real. See apps/agent/README.md.
- `apps/web`: the reader. Real public-domain content (an Aesop fable read by LibriVox volunteers) with real generated captions: play, read-that-line-again, slow mode with pitch preservation, reading-optimized Lexend type, adjustable size, light and dark themes, and a words-read-along meter.
- `tv/`: the Fire TV app (react-native-tvos), targeting **Fire OS** and sideloadable to any Fire TV device as an APK. Same karaoke renderer, same real content, 10-foot UI with D-pad focus. No physical Fire TV was available, so it was tested on an Android Virtual Device, which is Amazon's own documented method for emulating an Amazon device: see docs/screenshots/tv-emulator-karaoke.png and [docs/FIRE_TV_TARGET.md](docs/FIRE_TV_TARGET.md), which states exactly what that does and does not prove. Lives outside the npm workspaces on purpose; metro.config.js documents the monorepo wiring.

## Run it

```
npm install
npm test                 # 86 tests: caption engine, MCP server, every public claim, and every documented API
npm run web:dev          # the reader on localhost:3000

# generate captions for new content (needs AWS credentials):
npm run pipeline -- --input <url|file> --name my-story --title "My Story" --attribution "..."
```

## Every number here is a test

The figures in the first paragraph are not typed in. [`apps/eval/test/claims.test.ts`](apps/eval/test/claims.test.ts) re-derives each one from `apps/eval/results/librispeech.json`, the committed output of the LibriSpeech run, and checks that the same figure appears in this README, the submission, the evidence, the design notes, the AWS notes and the Agent Skill.

One assertion is stricter than the rest. Zero words lit early beyond 150 ms, across all 766 matched words, is asserted as an exact zero rather than a threshold, because a highlight that runs ahead of the voice teaches a learning reader the wrong word and is worse than no highlight at all. That number is not allowed to drift quietly into "almost none".

## Verify the live MCP server yourself

Opening an MCP URL in a browser shows an error, because the protocol is a POST with a session handshake. So there is a probe:

```
npm run verify:live            # this project's deployed server
npm run verify:live -- --all   # all three servers built for this hackathon
```

No install and no MCP client library: one dependency-free Node script against the deployed Lambda. It checks nineteen rules from spec revision 2025-11-25 over real HTTP, including the two shapes that in-process tests never produce: a DELETE carrying a JSON content-type and an empty body, and a body the server cannot parse.

It grades what it checks. A MUST failure is a spec violation and exits non-zero; a SHOULD failure is reported and does not. Where the spec allows more than one answer, such as GET opening a stream or declining with 405, the probe accepts either and says which it saw. A conformance tool that grades its own preferences as violations teaches people to ignore it.

It has already paid for itself. Its first run against the deployed Lambdas found that a malformed request body came back as an HTTP 500 carrying the framework's own error envelope, where JSON-RPC calls for a -32700 Parse error. Every in-process test passed while the live server was wrong, which is the whole argument for probing over real HTTP.

## Content licensing

Every item in the reader lists its provenance; see CONTENT_LICENSES.md. Launch content is public domain (LibriVox recordings of Aesop).

## License

MIT.

## Documentation

[SUBMISSION.md](docs/SUBMISSION.md) · [EVIDENCE.md](docs/EVIDENCE.md) · [DESIGN.md](docs/DESIGN.md) · [EVAL.md](docs/EVAL.md) · [AWS.md](docs/AWS.md) · [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) · [FEATURE_REQUESTS.md](docs/FEATURE_REQUESTS.md) · [VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md) · [FRICTION_LOG.md](FRICTION_LOG.md) · [PRODUCT_FEEDBACK.md](PRODUCT_FEEDBACK.md)
