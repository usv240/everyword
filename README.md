# EveryWord

Subtitles that light up word by word as they are spoken. Watching becomes reading.

Same Language Subtitling (SLS), karaoke-style same-language captions on ordinary entertainment, is one of the most proven literacy interventions ever measured: two decades on Indian national television, over 200 million weak readers receiving what researchers call automatic and inescapable reading practice, and a 100-plus-study evidence base showing captions improve reading with at-risk readers gaining most. Amazon already ships exactly this mechanic for books (Immersion Reading and Read and Listen). No TV platform has ever shipped it for video. EveryWord is that product: Immersion Reading, for television.

Built for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track, plus the AWS Builder and Open Source mini challenges).

## Live

- Reader: https://d34emfdcezeszz.cloudfront.net (real content, press Play)
- Deployed by the CDK stack in `infra/` (S3 and CloudFront); the caption pipeline runs on Amazon Transcribe

## What is here

- `packages/captions-core`: the EveryWord caption format (docs/FORMAT.md) and engine: an Amazon Transcribe normalizer with 42-character lines, clause-aware line breaks, and gap tiling so highlighting never flickers, plus the pure binary-search word-index math that drives the karaoke cursor. Fully unit tested.
- `packages/karaoke-captions-react`: the renderer, published standalone under MIT. Feed it a caption document and a currentTime; theme it with four CSS variables. The web reader and the Fire TV app share it.
- `apps/pipeline`: media in, captions out. Uploads to S3, runs Amazon Transcribe (word-level timestamps), normalizes, and drops media plus captions plus a manifest entry into the reader's content directory.
- `apps/web`: the reader. Real public-domain content (an Aesop fable read by LibriVox volunteers) with real generated captions: play, read-that-line-again, slow mode with pitch preservation, reading-optimized Lexend type, adjustable size, light and dark themes, and a words-read-along meter.
- `tv/`: the Fire TV app (react-native-tvos). Same karaoke renderer, same real content, 10-foot UI with D-pad focus, running on the Android TV emulator: see docs/screenshots/tv-emulator-karaoke.png. Lives outside the npm workspaces on purpose; metro.config.js documents the monorepo wiring.

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
