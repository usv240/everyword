# External Evaluation: Karaoke Timing Against Gold Alignments

EveryWord's product claim is precise: every word lights up at the moment it is spoken. This document measures that claim on speech and alignments we did not author, with a method a judge can rerun from the repository.

## Headline result

| Measure | Result |
|---|---|
| Words matched to gold reference | 766 of 788 (97.2 percent) |
| Highlight onset error, median | **30 ms** |
| Highlight onset error, p90 | 85 ms |
| Negative control: words lit EARLY beyond 150 ms | **0 of 766** |
| Line breaks landing on real pauses: EveryWord | **42 percent** |
| Line breaks landing on real pauses: naive fixed-width chunker | 2 percent |
| Lines over the 42-character budget | 0 |

For scale: 30 ms is around one frame of video. A reader cannot perceive the highlight and the voice as separate events at that offset, and the zero in the early-light row is the one that matters for reading: EveryWord never tells a learner a word has been said before it has.

## The data (not ours)

45 utterances by 27 speakers from LibriSpeech dev-clean (public audiobook speech corpus), with gold word-level timings from Montreal Forced Aligner alignments, via the Hugging Face dataset `gilkeyio/librispeech-alignments`. Neither the recordings nor the alignments were produced by us.

## Method, deterministic and leakage-free

1. Utterances are sampled at fixed offsets across the split (many speakers, no cherry-picking), decode-validated, and stitched into one audio file with one-second silences between them, each utterance's global offset recorded.
2. One Amazon Transcribe pass over the stitched file: the identical service call the production caption pipeline makes, no tuning, no vocabulary hints.
3. Hypothesis words are aligned to gold words per utterance by edit-distance alignment on normalized tokens; only exact token matches are scored, so substitution errors can never flatter the timing numbers.
4. Onset error is the absolute difference between the Transcribe word start (which drives the karaoke highlight) and the gold word start. The early-light control counts matched words whose highlight would begin more than 150 ms before the gold onset.
5. The segmentation comparison judges every internal line break whose two boundary words both matched gold, asking whether the break coincides with a real inter-word pause of at least 300 ms in the gold timing. The baseline is the obvious alternative: greedy fixed-width packing at the same 42-character budget, timing-blind, which is how most caption tools break lines.

Reproduce it:

```
npm run librispeech -w @everyword/eval
```

The committed `apps/eval/results/librispeech.json` is the run reported here. The script caches the stitched audio and the Transcribe result locally, so reruns of the analysis are free and instant.

## Measured limits, stated plainly

- This is clean, read, single-speaker English. Word timing on music-heavy or overlapping speech will be worse; the pipeline's catalog policy (dialogue-forward content) exists for exactly that reason.
- 2.8 percent of gold words found no exact-match hypothesis token (misrecognitions and number formatting); those words are excluded from timing scores rather than guessed at.
- The 42 percent pause-alignment figure is honest about read speech: audiobook narration simply does not pause at every line break a 42-character budget forces. The comparison that matters is the factor of 21 over timing-blind chunking on identical text.
- The corpus evaluation infrastructure surfaced a data-quality lesson recorded in FRICTION_LOG.md: streamed dataset audio must be decode-validated before use, or truncated downloads silently corrupt every downstream number.
