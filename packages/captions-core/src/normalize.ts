import type {
  CaptionDoc,
  CaptionSegment,
  CaptionWord,
  NormalizeOptions,
  TranscribeResult,
} from "./types";

/**
 * Turn Amazon Transcribe output into an EveryWord caption document.
 *
 * Three responsibilities, in order:
 * 1. Words: merge pronunciation items with their trailing punctuation, so
 *    "fox" + "." becomes the display token "fox." with the spoken timing.
 * 2. Segmentation: break the word stream into display lines a reader can
 *    follow: a line-length budget (42 characters, the classic subtitle
 *    guideline), a new line on real silence, a duration cap, and a
 *    clause-aware lookback so a line prefers to end at punctuation
 *    instead of mid-phrase.
 * 3. Tiling: within a segment, close sub-perceptual gaps between words so
 *    the karaoke highlight never flickers off between syllables.
 */

const DEFAULTS = {
  maxChars: 42,
  maxGapSec: 0.9,
  maxDurSec: 7,
  tileGapSec: 0.12,
  language: "en",
};

/** Merge Transcribe items into timed display words. */
export function transcribeItemsToWords(result: TranscribeResult): CaptionWord[] {
  const words: CaptionWord[] = [];
  for (const item of result.results.items) {
    const content = item.alternatives[0]?.content ?? "";
    if (item.type === "pronunciation") {
      const s = Number(item.start_time);
      const e = Number(item.end_time);
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
      words.push({ w: content, s, e });
    } else if (words.length > 0) {
      // Punctuation carries no timing; attach it to the previous word.
      words[words.length - 1]!.w += content;
    }
  }
  return words;
}

const CLAUSE_END = /[.,;:!?]["')\]]?$/;

function lineLength(words: CaptionWord[]): number {
  return words.reduce((n, w, i) => n + w.w.length + (i > 0 ? 1 : 0), 0);
}

/** Break a word stream into display segments. Exported for testing. */
export function segmentWords(
  words: CaptionWord[],
  opts: NormalizeOptions = {},
): CaptionSegment[] {
  const { maxChars, maxGapSec, maxDurSec } = { ...DEFAULTS, ...opts };
  const segments: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  const push = (seg: CaptionWord[]): void => {
    if (seg.length > 0) segments.push(seg);
  };

  for (const word of words) {
    if (current.length > 0) {
      const prev = current[current.length - 1]!;
      const gap = word.s - prev.e;
      const projectedLen = lineLength(current) + 1 + word.w.length;
      const projectedDur = word.e - current[0]!.s;

      if (gap >= maxGapSec || projectedDur > maxDurSec) {
        // Real silence or an over-long line's worth of time: hard break.
        push(current);
        current = [];
      } else if (projectedLen > maxChars) {
        // Line-length overflow. Prefer ending the line at punctuation
        // instead of mid-phrase, looking back up to half the line
        // (at most five words), and always leaving at least one word.
        let splitAfter = -1;
        const window = Math.min(5, Math.ceil(current.length / 2), current.length - 1);
        for (let back = 0; back < window; back++) {
          const idx = current.length - 1 - back;
          if (CLAUSE_END.test(current[idx]!.w)) {
            splitAfter = idx;
            break;
          }
        }
        if (splitAfter >= 0) {
          const carry = current.slice(splitAfter + 1);
          push(current.slice(0, splitAfter + 1));
          // If the carried tail plus the new word still overflows, the
          // tail becomes its own line rather than growing past budget.
          if (lineLength(carry) + 1 + word.w.length > maxChars && carry.length > 0) {
            push(carry);
            current = [];
          } else {
            current = carry;
          }
        } else {
          push(current);
          current = [];
        }
      }
    }
    current.push(word);
  }
  push(current);

  return segments.map((segWords, id) => tileSegment(segWords, id, opts));
}

/** Close sub-perceptual gaps and build the segment record. */
function tileSegment(
  segWords: CaptionWord[],
  id: number,
  opts: NormalizeOptions,
): CaptionSegment {
  const { tileGapSec } = { ...DEFAULTS, ...opts };
  const words = segWords.map((w) => ({ ...w }));
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1]!.s - words[i]!.e;
    if (gap > 0 && gap < tileGapSec) {
      words[i]!.e = words[i + 1]!.s;
    }
  }
  return {
    id,
    start: words[0]?.s ?? 0,
    end: words[words.length - 1]?.e ?? 0,
    text: words.map((w) => w.w).join(" "),
    words,
  };
}

/** Full pipeline: Transcribe result to EveryWord caption document. */
export function normalizeTranscribe(
  result: TranscribeResult,
  opts: NormalizeOptions = {},
): CaptionDoc {
  const words = transcribeItemsToWords(result);
  const segments = segmentWords(words, opts);
  return {
    version: "1.0",
    language: opts.language ?? DEFAULTS.language,
    source: { kind: "transcribe", generatedAt: new Date().toISOString() },
    segments,
  };
}
