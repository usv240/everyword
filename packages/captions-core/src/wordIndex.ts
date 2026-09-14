import type { CaptionDoc, WordIndex } from "./types";

/**
 * The karaoke cursor: which segment and word are live at time t.
 *
 * Pure and allocation-free on the hot path; renderers call this on every
 * time update (10 to 20 times a second), so it binary-searches segments
 * and words instead of scanning.
 *
 * Semantics chosen for reading UX:
 * - Before the first segment: segment -1.
 * - Inside a segment, the active word is the LAST word whose start is at
 *   or before t. During any intra-segment silence the previous word stays
 *   lit rather than blinking off, which keeps a reader's eye anchored.
 * - Between segments, the previous segment stays current with its last
 *   word lit, so the line does not vanish during a breath pause.
 * - After the final segment ends, finished is true.
 */
export function computeWordIndex(doc: CaptionDoc, t: number): WordIndex {
  const segs = doc.segments;
  if (segs.length === 0) return { segment: -1, word: -1, finished: false };
  if (t < segs[0]!.start) return { segment: -1, word: -1, finished: false };

  // Binary search: last segment with start <= t.
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid]!.start <= t) lo = mid;
    else hi = mid - 1;
  }
  const seg = segs[lo]!;
  const words = seg.words;

  // Binary search: last word with start <= t.
  let wlo = 0;
  let whi = words.length - 1;
  while (wlo < whi) {
    const mid = (wlo + whi + 1) >> 1;
    if (words[mid]!.s <= t) wlo = mid;
    else whi = mid - 1;
  }

  const lastSeg = segs[segs.length - 1]!;
  const finished = t >= lastSeg.end && lo === segs.length - 1;
  return { segment: lo, word: wlo, finished };
}

/** Total word count, the reading-exposure denominator. */
export function countWords(doc: CaptionDoc): number {
  return doc.segments.reduce((n, s) => n + s.words.length, 0);
}

/** Duration of the captioned content in seconds. */
export function docDuration(doc: CaptionDoc): number {
  const last = doc.segments[doc.segments.length - 1];
  return last ? last.end : 0;
}
