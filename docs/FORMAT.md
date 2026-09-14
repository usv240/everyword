# The EveryWord Caption Format, version 1.0

A word-timed caption document for karaoke (word-by-word highlighted) rendering. JSON, UTF-8, media type application/json. Produced by @everyword/captions-core and consumed by karaoke-captions-react; both are MIT licensed, and this format is open for anyone to emit or consume.

## Shape

```json
{
  "version": "1.0",
  "language": "en",
  "source": { "kind": "transcribe", "generatedAt": "2026-09-14T00:00:00.000Z" },
  "segments": [
    {
      "id": 0,
      "start": 0.78,
      "end": 4.19,
      "text": "Section 14 of Fables of Aesop and others.",
      "words": [
        { "w": "Section", "s": 0.78, "e": 1.24 },
        { "w": "14", "s": 1.24, "e": 1.66 }
      ]
    }
  ]
}
```

## Rules

1. Times are seconds from media start. `s` strictly increases within a segment; segments are ordered by `start` and never overlap.
2. A segment is one display line. Producers should keep `text` at or under 42 characters (the classic subtitle readability budget) and prefer line breaks at clause punctuation.
3. Trailing punctuation is attached to the word it follows: the display token is "fox.", timed by the spoken word.
4. Tiling: producers should close inter-word gaps shorter than 120 ms (set the earlier word's `e` to the next word's `s`), so a renderer highlighting the last started word never flickers between syllables. Gaps of 120 ms and longer are real pauses and stay.
5. `text` equals the segment's word tokens joined with single spaces.
6. Renderer semantics (what karaoke-captions-react implements): the active word at time t is the last word whose `s` is at or before t; during pauses the previous word stays lit; between segments the previous line stays visible.
7. Unknown extra fields must be ignored by consumers; producers may extend with namespaced fields but must not change the meaning of the fields above within version 1.0.

## Reference producer

`@everyword/captions-core` normalizes Amazon Transcribe results (word-level timestamps) into this format: `normalizeTranscribe(result, options)`. Options: `maxChars` (42), `maxGapSec` (0.9, silence that forces a new line), `maxDurSec` (7, maximum line duration), `tileGapSec` (0.12).
