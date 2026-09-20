/**
 * Upgrade an existing subtitle track to word level.
 *
 * The idea this package exists to serve is Same Language Subtitling:
 * captions in the language you are already hearing, highlighted word by
 * word, on content you were going to watch anyway. The research behind it
 * measures what happens when subtitles ride *existing entertainment*, not
 * when someone opens a reading app.
 *
 * Which means the bottleneck was never rendering. It is that every video
 * in the world already has subtitles and every one of them is line level.
 * A line tells a renderer when to show a sentence. It cannot tell it
 * which word is being spoken right now, so it cannot teach anyone to
 * read.
 *
 * What this does
 * --------------
 * Given the subtitle file a video already ships with, and a speech
 * recognition pass over the same audio, it produces word-level timings.
 *
 * The words come from the subtitle file. The timings come from the
 * recogniser. That split is the whole design:
 *
 *   - **Zero word error, by construction.** The output text is the
 *     subtitle author's text, letter for letter. A recogniser that hears
 *     "their" for "there" cannot change what is displayed, because the
 *     recogniser is never asked what the words are. This is the same
 *     argument as the Polly path, where the words were known before they
 *     were spoken, applied to content nobody here authored.
 *
 *   - **Line breaks are the author's.** Segments are the original cues,
 *     unchanged. A human decided where those lines break, usually for
 *     good reasons about phrasing and reading speed, and re-breaking them
 *     would be this library asserting it knows better than the person who
 *     wrote them. It does not.
 *
 * How the alignment works
 * -----------------------
 * Cue by cue, rather than one global alignment over the whole file.
 *
 * A global Needleman-Wunsch over a feature film is a twenty thousand by
 * twenty thousand matrix, and it throws away information we already have:
 * the cue times. Those times are approximately right, which is enough to
 * bound the search. So for each cue we take only the recognised words
 * whose midpoint falls near it, and align that short window against that
 * cue's words. Each alignment is a few dozen cells, and a mistake cannot
 * propagate past one cue.
 *
 * Words the recogniser missed get a time interpolated between their
 * aligned neighbours, clamped inside the cue. So a word is always on
 * screen during the line it belongs to, even in the worst case where the
 * recogniser heard nothing at all.
 */

import type { CaptionDoc, CaptionSegment, CaptionWord } from "./types.js";

/** One recognised word, as a speech recogniser reports it. */
export interface RecognisedWord {
  w: string;
  s: number;
  e: number;
  /** 0..1 where the recogniser reports it. Unused by the alignment. */
  conf?: number;
}

/** One line of an existing subtitle file. */
export interface SubtitleCue {
  start: number;
  end: number;
  /** As written, including punctuation and any internal line breaks. */
  text: string;
}

export interface UpgradeOptions {
  language?: string;
  /**
   * Seconds of slack either side of a cue when gathering candidate
   * recognised words. Subtitle times are often a beat early or late, and
   * a word half a second outside the cue is usually still that cue's
   * word. Too generous and neighbouring cues start competing for the
   * same word; 1.2s was comfortable across the test material.
   */
  windowPadSec?: number;
  /**
   * Smallest duration a word may be given, in seconds. Prevents a word
   * from being zero-length when several unmatched words share a short
   * span, which would make the karaoke cursor skip it entirely.
   */
  minWordSec?: number;
}

const DEFAULTS = { windowPadSec: 1.2, minWordSec: 0.06 } as const;

/**
 * Compare forms for matching only. Never displayed.
 *
 * Case, punctuation and the various apostrophes all differ routinely
 * between a subtitle file and a recogniser, and none of those
 * differences mean the words are different. Digits are left alone: a
 * recogniser that writes "5" where the subtitle says "five" simply will
 * not match, and that word falls to interpolation, which is correct and
 * safe rather than clever and wrong.
 */
export function compareForm(word: string): string {
  return word
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, "")
    .replace(/^'+|'+$/g, "");
}

/** Split a cue into display words, keeping punctuation attached. */
export function cueWords(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

interface Pair {
  /** Index into the cue's words. */
  cue: number;
  /** Index into the window's recognised words, or -1 if unmatched. */
  rec: number;
}

/**
 * Needleman-Wunsch over two short token lists.
 *
 * Global alignment rather than local: every subtitle word must come out
 * the other side, matched or not, because every subtitle word has to be
 * displayed. Local alignment would be free to drop the ends of a line.
 */
export function alignTokens(cue: string[], rec: string[]): Pair[] {
  const MATCH = 2;
  const MISMATCH = -1;
  const GAP = -1;
  const n = cue.length;
  const m = rec.length;
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) score[i]![0] = i * GAP;
  for (let j = 1; j <= m; j++) score[0]![j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[i - 1]![j - 1]! + (cue[i - 1] === rec[j - 1] ? MATCH : MISMATCH);
      score[i]![j] = Math.max(diag, score[i - 1]![j]! + GAP, score[i]![j - 1]! + GAP);
    }
  }
  const pairs: Pair[] = [];
  let i = n;
  let j = m;
  while (i > 0) {
    const here = score[i]![j]!;
    if (
      j > 0 &&
      here === score[i - 1]![j - 1]! + (cue[i - 1] === rec[j - 1] ? MATCH : MISMATCH)
    ) {
      // Only count it as an anchor when the words actually agree. A
      // substitution keeps the alignment's shape but must not lend its
      // timing to a different word.
      pairs.push({ cue: i - 1, rec: cue[i - 1] === rec[j - 1] ? j - 1 : -1 });
      i--;
      j--;
    } else if (here === score[i - 1]![j]! + GAP) {
      pairs.push({ cue: i - 1, rec: -1 });
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
}

/**
 * Give every word in a cue a start time.
 *
 * Anchored words take the recogniser's time. Runs of unanchored words are
 * spread evenly between the anchors either side of them, and a run with
 * no anchor either side is spread across the cue. Everything is clamped
 * inside the cue and forced to increase, so the cursor can never move
 * backwards or leave the line it belongs to.
 */
function timeCue(
  words: string[],
  pairs: Pair[],
  rec: RecognisedWord[],
  cue: SubtitleCue,
  minWordSec: number,
): number[] {
  const n = words.length;
  const at: (number | null)[] = new Array(n).fill(null);
  for (const p of pairs) {
    if (p.rec >= 0 && rec[p.rec]) {
      at[p.cue] = Math.min(Math.max(rec[p.rec]!.s, cue.start), cue.end);
    }
  }

  // Anchors must increase. A recogniser can report words out of order
  // across a window boundary; keeping a decreasing anchor would drag the
  // cursor backwards mid-line.
  let last = -Infinity;
  for (let i = 0; i < n; i++) {
    if (at[i] !== null) {
      if (at[i]! < last) at[i] = null;
      else last = at[i]!;
    }
  }

  const out: number[] = new Array(n).fill(cue.start);
  let i = 0;
  while (i < n) {
    if (at[i] !== null) {
      out[i] = at[i]!;
      i++;
      continue;
    }
    // A run of unanchored words: [i, j)
    let j = i;
    while (j < n && at[j] === null) j++;
    const before = i > 0 ? out[i - 1]! : cue.start;
    const after = j < n ? at[j]! : cue.end;
    const span = Math.max(after - before, 0);
    const count = j - i + (i > 0 ? 1 : 0);
    const step = count > 0 ? span / (count + (j < n ? 0 : 1)) : 0;
    for (let k = i; k < j; k++) {
      out[k] = before + step * (k - i + (i > 0 ? 1 : 0));
    }
    i = j;
  }

  // One forward pass that guarantees three things at once: inside the
  // cue, strictly increasing, and never zero length.
  //
  // The upper bound is what makes the last part work. Each word is held
  // back far enough from the end of the cue to leave every word after it
  // its own minWordSec. Without that, an anchor landing near the end
  // squeezed the remaining words into the same instant, and a word with
  // zero duration is a word the karaoke cursor never lands on: it is on
  // screen, it is never highlighted, and the reader is quietly told it
  // does not need saying.
  //
  // An earlier version clamped backwards from the end instead, which had
  // the same failure at the other end of the line: an anchor a few
  // milliseconds before its cue began collapsed every word ahead of it
  // onto the cue's start.
  //
  // If the cue is genuinely too short for its own words, the lower bound
  // wins and they come out evenly spaced at minWordSec. That is a cue
  // whose author asked for more reading than there was time for, and
  // spacing them evenly is the least wrong thing to do with it.
  for (let k = 0; k < n; k++) {
    const lower = k === 0 ? cue.start : out[k - 1]! + minWordSec;
    // (n - k), not (n - 1 - k): the last word needs a slot of its own
    // too. Its end is the cue's end, so a start clamped exactly onto
    // cue.end gave it zero duration, which is the same invisible
    // failure this bound exists to prevent, one word further along.
    const upper = cue.end - (n - k) * minWordSec;
    out[k] = Math.min(Math.max(out[k]!, lower), Math.max(upper, lower));
  }
  return out;
}

/**
 * The public entry point: an existing subtitle track plus a recognition
 * pass over the same audio, in; a word-level caption document, out.
 */
export function upgradeSubtitles(
  cues: SubtitleCue[],
  recognised: RecognisedWord[],
  options: UpgradeOptions = {},
): CaptionDoc {
  const windowPad = options.windowPadSec ?? DEFAULTS.windowPadSec;
  const minWordSec = options.minWordSec ?? DEFAULTS.minWordSec;

  const recForms = recognised.map((r) => compareForm(r.w));
  const segments: CaptionSegment[] = [];

  cues.forEach((cue, index) => {
    const words = cueWords(cue.text);
    if (words.length === 0) return;

    // Candidate recognised words for this cue, by time.
    const lo = cue.start - windowPad;
    const hi = cue.end + windowPad;
    const windowIdx: number[] = [];
    for (let k = 0; k < recognised.length; k++) {
      const mid = (recognised[k]!.s + recognised[k]!.e) / 2;
      if (mid >= lo && mid <= hi) windowIdx.push(k);
    }

    const pairs = alignTokens(
      words.map(compareForm),
      windowIdx.map((k) => recForms[k]!),
    ).map((p) => ({ cue: p.cue, rec: p.rec >= 0 ? windowIdx[p.rec]! : -1 }));

    const starts = timeCue(words, pairs, recognised, cue, minWordSec);
    const captionWords: CaptionWord[] = words.map((w, k) => ({
      w,
      s: round(starts[k]!),
      // Tiled: a word owns the screen until the next one starts, so the
      // karaoke cursor never has a gap to flicker in.
      e: round(k + 1 < words.length ? starts[k + 1]! : cue.end),
    }));

    segments.push({
      id: index,
      start: round(cue.start),
      end: round(cue.end),
      text: words.join(" "),
      words: captionWords,
    });
  });

  return {
    version: "1.0",
    language: options.language ?? "en",
    source: { kind: "aligned", generatedAt: new Date().toISOString() },
    segments,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * How much of the subtitle track the recogniser actually anchored.
 *
 * Reported rather than hidden. A low rate does not make the output wrong
 * (the words are still the author's and still inside their own lines) but
 * it does mean more of the timing is interpolation, and anyone shipping
 * this to readers deserves to know that before they do.
 */
export function anchorRate(
  cues: SubtitleCue[],
  recognised: RecognisedWord[],
  options: UpgradeOptions = {},
): { words: number; anchored: number; rate: number } {
  const windowPad = options.windowPadSec ?? DEFAULTS.windowPadSec;
  const recForms = recognised.map((r) => compareForm(r.w));
  let words = 0;
  let anchored = 0;
  for (const cue of cues) {
    const w = cueWords(cue.text);
    if (w.length === 0) continue;
    words += w.length;
    const lo = cue.start - windowPad;
    const hi = cue.end + windowPad;
    const idx: number[] = [];
    for (let k = 0; k < recognised.length; k++) {
      const mid = (recognised[k]!.s + recognised[k]!.e) / 2;
      if (mid >= lo && mid <= hi) idx.push(k);
    }
    const pairs = alignTokens(w.map(compareForm), idx.map((k) => recForms[k]!));
    anchored += pairs.filter((p) => p.rec >= 0).length;
  }
  return { words, anchored, rate: words ? anchored / words : 0 };
}
