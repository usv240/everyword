/**
 * @format
 *
 * The library the television offers, and where its numbers come from.
 *
 * This app shipped with one hardcoded story while the web reader had
 * five, on the track this project entered as its primary one. These
 * tests pin that it carries the whole shelf, and that the figures on the
 * story cards are computed from the caption documents rather than typed
 * in beside them.
 *
 * That second point is the one worth a test. A word count written by
 * hand is a third number, next to the manifest's and the cursor's, that
 * nothing checks and that goes stale the first time a caption document
 * is regenerated.
 */

import {countWords, docDuration} from '@everyword/captions-core';
import {LIBRARY, formatDuration} from '../src/library';

test('carries the whole library, not one story', () => {
  expect(LIBRARY.length).toBe(6);
  const slugs = LIBRARY.map(s => s.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  expect(slugs).toContain('two-pots');
});

test('every story has captions, audio and an attribution', () => {
  for (const s of LIBRARY) {
    expect(s.captions).toBeTruthy();
    expect(s.captions.segments.length).toBeGreaterThan(0);
    expect(s.media).toBeTruthy();
    // Openly licensed provenance is not decoration on a children's
    // product, and it is not all one licence: the fables are public
    // domain, and the film is Creative Commons Attribution, which
    // obliges us to name the Blender Foundation wherever it plays.
    expect(s.attribution).toMatch(/public domain|CC BY/i);
  }
});

test('word counts and durations are derived from the caption document', () => {
  for (const s of LIBRARY) {
    expect(s.words).toBe(countWords(s.captions));
    expect(s.durationSec).toBe(docDuration(s.captions));
    expect(s.words).toBeGreaterThan(0);
    expect(s.durationSec).toBeGreaterThan(0);
  }
});

test('names how each story was timed, because the paths differ', () => {
  const sources = new Set(LIBRARY.map(s => s.source));
  // All three paths are represented, which is the point of showing it:
  // text we synthesised, a human recording we timed, and a subtitle
  // track that already existed and we only upgraded.
  expect(sources.has('polly')).toBe(true);
  expect(sources.has('transcribe')).toBe(true);
  expect(sources.has('aligned')).toBe(true);
});

test('carries at least one real video, because that is the whole thesis', () => {
  // The app shipped for a while claiming that watching becomes reading
  // while containing nothing to watch: every title was an MP3 and the
  // video element was zero by zero. This is the test that would have
  // said so.
  const videos = LIBRARY.filter(s => s.video);
  expect(videos.length).toBeGreaterThan(0);
  for (const v of videos) {
    expect(v.captions.source.kind).toBe('aligned');
  }
});

test('formats a duration the way a card shows it', () => {
  expect(formatDuration(28)).toBe('28s');
  expect(formatDuration(97)).toBe('1m 37s');
  expect(formatDuration(120)).toBe('2m 0s');
});
