# EveryWord

**Every video in the world already has subtitles. Every one of them is line level.** A subtitle file says what was said and when the line starts. It never says which word is being spoken, so nothing can highlight one, so no subtitle track on earth can teach anybody to read.

EveryWord adds the only thing missing. Give it the subtitle file a video already ships with and it returns the same words with a time on each, ready to light one at a time as they are spoken. The words come from the subtitle author; the timings come from Amazon Transcribe, which is never asked what the words are. A recogniser that hears "their" for "there" therefore cannot put the wrong spelling in front of a child learning to read: **zero word error by construction**. The line breaks stay the author's, because a human chose them.

Proved on a film nobody here made. Sintel is distributed by the Blender Foundation as an MKV with English SubRip inside it. Fourteen cues, 75 words, **74 of 75 anchored to a recognised word (98.7 percent)**, and the displayed text identical to the file that shipped. The original subtitles, the caption document made from them, and everything the recogniser heard are all served from the live site.

The renderer is measured too, against gold LibriSpeech alignments on speech we did not record: the highlight lands within 30 ms of the spoken word (median, p90 85 ms), never lights a word early beyond 150 ms across 766 matched words, and breaks lines at real pauses 42 percent of the time where timing-blind chunking manages 2 ([docs/EVAL.md](docs/EVAL.md)).

Run again on **test-other**, the split LibriSpeech itself sets aside as hard, with accents, noisier recordings and 26 speakers who appear nowhere in the clean split: the median onset error is the same 30 ms, the p90 the same 85 ms, and it still lights **zero** words early across 761 matched words. Match rate slips from 97.2 to 96.7 percent, which is the direction a harder split predicts and is stated rather than rounded away.

Why this has to work on video that already exists: Same Language Subtitling, karaoke-style same-language captions on ordinary entertainment, is one of the most proven literacy interventions ever measured. Two decades on Indian national television, 10 programmes reaching an estimated 200 million viewers, Indian national broadcast policy since 2019. A five-year study of 13,000 people who could initially read little or nothing found 32 percentage points more children becoming good readers than in the unexposed group, at $0.004 per learner (UNESCO Institute for Lifelong Learning). More than 100 empirical studies find captions improve comprehension, attention and memory, with people learning to read among those who gain most (Gernsbacher, 2015). Sources for every claim in [docs/EVIDENCE.md](docs/EVIDENCE.md).

**It worked because nobody signed up for it.** The reading practice rode programmes people had already chosen to watch. That is the part a reading app cannot reproduce, and it is the reason EveryWord upgrades the captions on existing video rather than shipping a library of its own. Amazon already ships this mechanic for books, as Immersion Reading. No television platform has shipped it for video, because until the captions can carry a word there is nothing to light.

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
- `tv/`: the Fire TV app (react-native-tvos), targeting **Fire OS** and sideloadable to any Fire TV device as an APK. Same karaoke renderer, same real content, 10-foot UI with D-pad focus. The **whole five-story library** is bundled, chosen from a D-pad row whose word counts are computed from the caption documents rather than written beside them. The remote's real media keys work (play/pause, five-second rewind and fast-forward, Back to the library), which the first version ignored entirely. It is also **a client of this project's own MCP server**: when a story ends or is left, the app reports the words the cursor actually passed through `record_reading_session`, over the same public endpoint and the same transport Alexa+ uses, with no shared secret. That is what makes `get_reading_progress` a reading number rather than a number an assistant wrote to itself. Reporting failures are silent by design; the reader works with the network unplugged. No physical Fire TV was available, so it was tested on an Android Virtual Device, which is Amazon's own documented method for emulating an Amazon device: see docs/screenshots/tv-emulator-karaoke.png and [docs/FIRE_TV_TARGET.md](docs/FIRE_TV_TARGET.md), which states exactly what that does and does not prove. Lives outside the npm workspaces on purpose; metro.config.js documents the monorepo wiring.

## Run it

```
npm install
npm test                 # 140 tests: caption engine, MCP server, the Fire TV app, every public claim, and every documented API
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
