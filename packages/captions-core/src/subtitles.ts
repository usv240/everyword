/**
 * Read an existing subtitle file: SubRip or WebVTT.
 *
 * One reader for both, because for our purposes they differ in a comma,
 * an optional header, and optional cue settings after the timestamps.
 * Two parsers to express that would be two things to keep in step.
 *
 * This is the front door of the whole upgrade path, so it is deliberately
 * forgiving. Subtitle files in the wild are written by many tools over
 * many years: some number their cues and some do not, some use commas and
 * some full stops, some carry an hours field and some start at minutes,
 * and a good number have a stray blank line or a byte-order mark. A
 * parser that rejects any of those rejects real content a family owns.
 *
 * What is deliberately thrown away
 * --------------------------------
 * Cue identifiers, cue settings (`line:`, `align:`, `position:`) and
 * inline markup. Positioning belongs to the renderer and this library's
 * renderer lays out its own lines. Markup goes because a subtitle reading
 * `<i>quietly</i>` should display the word "quietly": a karaoke cursor
 * has nothing to say about italics, and leaving the tags in would put
 * them on screen as if they were words to read.
 *
 * What is deliberately kept
 * -------------------------
 * The cue's own start and end, and its text exactly as written including
 * punctuation. Those times are what bound the alignment, and that text is
 * what gets displayed. Neither is ours to improve.
 */

import type { SubtitleCue } from "./align.js";

const TIMESTAMP =
  /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

const SKIP_BLOCK = /^(?:WEBVTT|NOTE|STYLE|REGION)\b/;

function seconds(
  hours: string | undefined,
  minutes: string,
  secs: string,
  fraction: string,
): number {
  const h = hours ? parseInt(hours, 10) : 0;
  const ms = parseInt(fraction.padEnd(3, "0").slice(0, 3), 10);
  return h * 3600 + parseInt(minutes, 10) * 60 + parseInt(secs, 10) + ms / 1000;
}

export function parseSubtitles(text: string): SubtitleCue[] {
  const body = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const cues: SubtitleCue[] = [];

  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;
    if (SKIP_BLOCK.test(lines[0]!.trim())) continue;

    // An optional numeric identifier above the timestamps.
    let i = 0;
    if (/^\d+$/.test(lines[0]!.trim()) && lines[1] !== undefined) i = 1;

    const line = lines[i];
    if (line === undefined) continue;
    const m = TIMESTAMP.exec(line.trim());
    if (m === null) continue;

    const start = seconds(m[1], m[2]!, m[3]!, m[4]!);
    const end = seconds(m[5], m[6]!, m[7]!, m[8]!);
    if (!(end > start)) continue;

    const text = lines
      .slice(i + 1)
      .join(" ")
      // HTML-ish markup, and the SubStation override codes that leak into
      // converted files.
      .replace(/<[^>]*>/g, " ")
      .replace(/\{\\[^}]*\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length === 0) continue;

    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Total speech time a subtitle file covers, in seconds.
 *
 * Used to sanity-check a pairing before spending a recognition pass on
 * it: a subtitle file whose last cue ends long after the media does is
 * usually the wrong file for that video, and finding that out from a
 * number is cheaper than finding it out from the finished captions.
 */
export function subtitleSpan(cues: SubtitleCue[]): { start: number; end: number } {
  if (cues.length === 0) return { start: 0, end: 0 };
  return {
    start: cues[0]!.start,
    end: cues.reduce((max, c) => Math.max(max, c.end), 0),
  };
}
