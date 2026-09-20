import type { CaptionDoc, WordIndex } from "./types.js";

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

/**
 * Where "read that line again" should seek to from time t.
 *
 * Returns the start of the line currently being read, or null when there
 * is no line to repeat.
 *
 * The null case is the whole function, and both readers got it wrong in
 * the same way. Before the first cue there is no current segment, and the
 * obvious `segments[Math.max(0, wi.segment)]` picks segment zero, whose
 * start is *later* than t during an opening title, a musical intro or any
 * silence before the first word. On Sintel, whose first cue begins at
 * 7.25s, pressing the button during the opening skipped the film forward
 * by a second and a half. A control labelled "again" must never advance
 * the media, so it returns null instead and callers do nothing.
 *
 * Between cues this needs no special case: computeWordIndex keeps the
 * previous segment current through a pause, so a reader who has missed
 * something in the gap after a line still gets that line back.
 */
export function replayTarget(doc: CaptionDoc, t: number): number | null {
  const wi = computeWordIndex(doc, t);
  if (wi.segment < 0) return null;
  const start = doc.segments[wi.segment]!.start;
  return start <= t ? start : null;
}
