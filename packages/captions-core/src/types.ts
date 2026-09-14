/**
 * The EveryWord caption format, version 1.0.
 *
 * A caption document is a list of display segments; each segment fully
 * tiles its duration with words, so a karaoke renderer can highlight one
 * word at every instant without flicker. Times are seconds. The full
 * format contract lives in docs/FORMAT.md.
 */

export interface CaptionWord {
  /** Display text, trailing punctuation attached. */
  w: string;
  /** Start time in seconds. */
  s: number;
  /** End time in seconds (after tiling, usually the next word's start). */
  e: number;
}

export interface CaptionSegment {
  id: number;
  start: number;
  end: number;
  /** The segment's words joined with single spaces. */
  text: string;
  words: CaptionWord[];
}

export interface CaptionDoc {
  version: "1.0";
  language: string;
  source: {
    kind: "transcribe" | "manual" | "aligned";
    generatedAt: string;
    model?: string;
  };
  segments: CaptionSegment[];
}

/** Where the karaoke cursor is at time t. -1 means before the first unit. */
export interface WordIndex {
  /** Index into doc.segments, or -1 before the first segment. */
  segment: number;
  /** Index into segment.words, or -1 before the first word of the segment. */
  word: number;
  /** True when t is past the end of the final segment. */
  finished: boolean;
}

/** Normalization options; defaults follow readability research for TV lines. */
export interface NormalizeOptions {
  /** Maximum characters per segment line (default 42). */
  maxChars?: number;
  /** A silence gap at or above this many seconds starts a new segment (default 0.9). */
  maxGapSec?: number;
  /** Maximum segment duration in seconds (default 7). */
  maxDurSec?: number;
  /** Inter-word gaps below this many seconds are tiled into the previous word (default 0.12). */
  tileGapSec?: number;
  language?: string;
}

/** The subset of an Amazon Transcribe result document that we consume. */
export interface TranscribeItem {
  type: "pronunciation" | "punctuation";
  start_time?: string;
  end_time?: string;
  alternatives: Array<{ content: string }>;
}

export interface TranscribeResult {
  results: {
    items: TranscribeItem[];
  };
}
