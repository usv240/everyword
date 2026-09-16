# EveryWord

Subtitles that light up word by word as they are spoken. Watching becomes reading. Measured against gold LibriSpeech alignments (speech we did not record): the highlight lands within 30 ms of the spoken word (median, p90 85 ms), never lights a word early beyond 150 ms across 766 matched words, and breaks lines at real pauses 42 percent of the time where timing-blind chunking manages 2 (docs/EVAL.md).

Same Language Subtitling (SLS), karaoke-style same-language captions on ordinary entertainment, is one of the most proven literacy interventions ever measured: two decades on Indian national television, 10 programmes reaching an estimated 200 million viewers, and Indian national broadcast policy since 2019. A five-year study of 13,000 people who could initially read little or nothing found 32 percentage points more children becoming good readers than in the unexposed group, at a cost of $0.004 per learner (UNESCO Institute for Lifelong Learning). Separately, more than 100 empirical studies find captions improve comprehension, attention and memory, with people learning to read among those who gain most (Gernsbacher, 2015). Sources for every claim are in [docs/EVIDENCE.md](docs/EVIDENCE.md). Amazon already ships exactly this mechanic for books (Immersion Reading and Read and Listen). No TV platform has ever shipped it for video. EveryWord is that product: Immersion Reading, for television.

Built for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track, plus the AWS Builder and Open Source mini challenges).

## Live

- Reader: https://d34emfdcezeszz.cloudfront.net (real content, press Play)
- Fire TV APK: https://github.com/usv240/everyword/releases/tag/v0.1.0 (self-contained, sideloads to a Fire TV device with `adb install`; the release carries sideload instructions and 58s of footage from an Android Virtual Device). Target platform, test environment and its limits: [docs/FIRE_TV_TARGET.md](docs/FIRE_TV_TARGET.md)
- MCP server (the Alexa+ surface): `https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp` (Model Context Protocol 2025-11-25 over Streamable HTTP, live)
- Deployed by the CDK stack in `infra/` (S3 and CloudFront for the reader, Lambda for the MCP server); the caption pipeline runs on Amazon Transcribe and Amazon Polly

## What is here

- `packages/captions-core`: the EveryWord caption format (docs/FORMAT.md), a standard **WebVTT exporter** (plain and karaoke, so our format is a superset rather than a silo), and the engine: an Amazon Transcribe normalizer with 42-character lines, clause-aware line breaks, and gap tiling so highlighting never flickers, plus the pure binary-search word-index math that drives the karaoke cursor. Fully unit tested.
- `packages/karaoke-captions-react`: the renderer, a standalone MIT-licensed package with no dependency on this repo. Feed it a caption document and a currentTime; theme it with four CSS variables. The web reader and the Fire TV app share it.
- `apps/pipeline`: two ways in, one caption format out. **Transcribe pipeline**: human-narrated media in, word timings measured at 30 ms median. **Polly pipeline**: any text in, narrated and timed from speech marks, with zero word error by construction because the words are known rather than recognized. The second is how any public-domain book becomes a read-along. Uploads to S3, runs Amazon Transcribe (word-level timestamps), normalizes, and drops media plus captions plus a manifest entry into the reader's content directory.
- `apps/mcp`: the **MCP server**, the Alexa+ surface, with reading sessions persisted in DynamoDB as an append-only log from which every reported figure is derived. Model Context Protocol spec 2025-11-25 over Streamable HTTP with five tools: `list_library`, `recommend_story`, `get_reading_progress`, `record_reading_session`, `get_story_text`. Twenty conformance tests. It is a second independent consumer of `captions-core`: word counts and durations are computed from the caption documents rather than trusted from the manifest, so the numbers an agent reports are the numbers the karaoke cursor is driven by.
- `apps/agent`: a Strands agent on Amazon Bedrock that consumes the MCP server as an outside client, which is the cheapest proof the surface is real. See apps/agent/README.md.
- `apps/web`: the reader. Real public-domain content (an Aesop fable read by LibriVox volunteers) with real generated captions: play, read-that-line-again, slow mode with pitch preservation, reading-optimized Lexend type, adjustable size, light and dark themes, and a words-read-along meter.
- `tv/`: the Fire TV app (react-native-tvos), targeting **Fire OS** and sideloadable to any Fire TV device as an APK. Same karaoke renderer, same real content, 10-foot UI with D-pad focus. No physical Fire TV was available, so it was tested on an Android Virtual Device, which is Amazon's own documented method for emulating an Amazon device: see docs/screenshots/tv-emulator-karaoke.png and [docs/FIRE_TV_TARGET.md](docs/FIRE_TV_TARGET.md), which states exactly what that does and does not prove. Lives outside the npm workspaces on purpose; metro.config.js documents the monorepo wiring.

## Run it

```
npm install
npm test                 # caption engine tests
npm run web:dev          # the reader on localhost:3000

# generate captions for new content (needs AWS credentials):
npm run pipeline -- --input <url|file> --name my-story --title "My Story" --attribution "..."
```

## Content licensing

Every item in the reader lists its provenance; see CONTENT_LICENSES.md. Launch content is public domain (LibriVox recordings of Aesop).

## License

MIT.
