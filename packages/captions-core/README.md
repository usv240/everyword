# @everyword/captions-core

Word-timed caption documents, a normalizer for Amazon Transcribe output, a standard WebVTT exporter, and the pure word-index math that drives karaoke highlighting.

MIT. Zero runtime dependencies. Node 18+.

```
npm install @everyword/captions-core
```

## What it is for

Captions normally carry line timings. This carries word timings, so a renderer can light up each word at the moment it is spoken. That mechanic is Same Language Subtitling, and it is one of the most studied reading interventions there is.

The format is documented and open: [FORMAT.md](https://github.com/usv240/everyword/blob/main/docs/FORMAT.md). Anyone may emit or consume it, and `toWebVTT` exists so it is a superset of a standard rather than a silo.

## Transcribe output in, caption document out

```ts
import { normalizeTranscribe } from "@everyword/captions-core";

const doc = normalizeTranscribe(transcribeResult, {
  maxChars: 42,     // characters per line
  maxGapSec: 0.9,   // silence that forces a new line
  maxDurSec: 7,     // longest a single line may stay up
  tileGapSec: 0.12, // gaps below this are tiled so highlighting cannot flicker
});
```

Three things it does that a naive splitter does not:

**Clause-aware line breaks.** Lines break at real pauses and clause boundaries rather than wherever the character budget runs out. Measured against gold forced alignments on LibriSpeech, breaks land on a real pause 42 percent of the time against 2 percent for fixed-width packing at the same budget.

**Gap tiling.** Sub-perceptual silences between words are absorbed, so a highlight never flickers off and on between two words of the same phrase.

**A hard character budget.** No line exceeds `maxChars`, which is what keeps captions readable at ten feet on a television.

## Driving a karaoke cursor

```ts
import { computeWordIndex } from "@everyword/captions-core";

const cursor = computeWordIndex(doc, currentTimeSeconds);
// { segment: 0, word: 2, finished: false }
```

Pure, synchronous and allocation-free on the hot path: it binary-searches segments and then words, so calling it ten to twenty times a second costs nothing.

Two behaviours are deliberate and worth knowing. During a silence inside a segment the previous word stays lit rather than blinking off, which keeps a reader's eye anchored. Between segments the previous line stays up with its last word lit, so nothing vanishes during a breath.

A React renderer that does exactly this is [`karaoke-captions-react`](https://www.npmjs.com/package/karaoke-captions-react).

## Exporting to WebVTT

```ts
import { toWebVTT } from "@everyword/captions-core";

toWebVTT(doc);                          // plain cues, plays anywhere
toWebVTT(doc, { karaoke: true });       // inline <00:00:01.234> timestamp tags
```

## Measured, not assumed

Against gold Montreal Forced Aligner alignments on LibriSpeech dev-clean, and again on test-other, the split the corpus itself labels hard:

| | dev-clean | test-other |
|---|---|---|
| Highlight onset error, median | 30 ms | 30 ms |
| Words lit early beyond 150 ms | 0 of 766 | 0 of 761 |

The early-light count is the one that matters. A highlight that runs ahead of the voice teaches a learning reader the wrong word, which is worse than no highlight at all, so it is measured as an exact zero rather than a tolerance. Method and reproduction: [EVAL.md](https://github.com/usv240/everyword/blob/main/docs/EVAL.md).

## API

- `normalizeTranscribe(result, options)` Amazon Transcribe result to a caption document
- `computeWordIndex(doc, t)` which segment and word are live at time `t`
- `toWebVTT(doc, options)` plain or karaoke WebVTT
- `countWords(doc)`, `docDuration(doc)` derived from the document rather than trusted from a manifest
- `transcribeItemsToWords(result)`, `segmentWords(words, opts)` the two halves of `normalizeTranscribe`, exported for testing
- Types: `CaptionDoc`, `CaptionSegment`, `CaptionWord`, `WordIndex`, `NormalizeOptions`, `WebVttOptions`, `TranscribeResult`

## License

MIT.
