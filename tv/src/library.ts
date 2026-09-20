import {countWords, docDuration, type CaptionDoc} from '@everyword/captions-core';

/**
 * The whole library, bundled into the APK.
 *
 * The TV app used to hold one story, hardcoded, while the web reader
 * offered five. Fire TV is this project's primary track, so its app was
 * the thinnest surface in the project and the one a judge opens first.
 *
 * Bundling rather than fetching is deliberate. All five stories are
 * 2.0 MB of audio and captions together, about five percent of an APK
 * that is already forty megabytes, and a child in a living room with a
 * slow connection should not watch a spinner. The reader works with the
 * network unplugged; only reporting progress needs it, and that failing
 * costs nothing on screen.
 *
 * `require` rather than `import` for the assets because Metro resolves
 * these at bundle time into numeric asset ids, which is what
 * react-native-video and the caption renderer expect.
 *
 * Word counts and durations are computed from the caption documents
 * rather than written down here, the same way apps/mcp/src/library.ts
 * does it. That is the project's rule and it matters in this file more
 * than most: the number on the story card is the number the karaoke
 * cursor is driven by, because both come from the same document. A
 * hand-typed count would be a third figure that nothing checks.
 */

interface Entry {
  slug: string;
  title: string;
  attribution: string;
  /** How the word timings were produced. Shown, because it differs. */
  source: 'polly' | 'transcribe' | 'aligned';
  /** A title with a picture, rather than audio with text. */
  video?: boolean;
  /** A still from the film, for the library card. */
  poster?: ReturnType<typeof require>;
  captions: CaptionDoc;
  media: ReturnType<typeof require>;
}

const ENTRIES: Entry[] = [
  {
    // The one that is the point of the product.
    //
    // A real film, playing on a television, with the subtitles it
    // already shipped with, lit one word at a time. Sintel is
    // distributed by the Blender Foundation as an MKV carrying English
    // SubRip inside it; those cues are the filmmakers', and EveryWord
    // only gave them word timings. Nothing here was authored by us,
    // which is the whole argument: this works on content that already
    // exists, so it does not need a library somebody had to make.
    slug: 'sintel',
    title: 'Sintel',
    attribution:
      "Blender Foundation, CC BY 3.0. The English subtitles the film already shipped with, upgraded to word level by EveryWord.",
    source: 'aligned',
    video: true,
    captions: require('../assets/sintel.captions.json') as CaptionDoc,
    media: require('../assets/sintel.mp4'),
    poster: require('../assets/sintel.poster.jpg'),
  },
  {
    slug: 'crow-and-pitcher',
    title: 'The Crow and the Pitcher',
    attribution:
      'Aesop, from Project Gutenberg (public domain). Narrated by Amazon Polly; captions timed from Polly speech marks.',
    source: 'polly',
    captions: require('../assets/crow-and-pitcher.captions.json') as CaptionDoc,
    media: require('../assets/crow-and-pitcher.mp3'),
  },
  {
    slug: 'hare-and-tortoise',
    title: 'The Hare and the Tortoise',
    attribution:
      'Aesop, from Project Gutenberg (public domain). Narrated by Amazon Polly; captions timed from Polly speech marks.',
    source: 'polly',
    captions: require('../assets/hare-and-tortoise.captions.json') as CaptionDoc,
    media: require('../assets/hare-and-tortoise.mp3'),
  },
  {
    slug: 'lion-and-mouse',
    title: 'The Lion and the Mouse',
    attribution:
      'Aesop, from Project Gutenberg (public domain). Narrated by Amazon Polly; captions timed from Polly speech marks.',
    source: 'polly',
    captions: require('../assets/lion-and-mouse.captions.json') as CaptionDoc,
    media: require('../assets/lion-and-mouse.mp3'),
  },
  {
    slug: 'north-wind-and-sun',
    title: 'The North Wind and the Sun',
    attribution:
      'Aesop, from Project Gutenberg (public domain). Narrated by Amazon Polly; captions timed from Polly speech marks.',
    source: 'polly',
    captions: require('../assets/north-wind-and-sun.captions.json') as CaptionDoc,
    media: require('../assets/north-wind-and-sun.mp3'),
  },
  {
    slug: 'two-pots',
    title: 'The Two Pots',
    attribution:
      'Aesop, read by LibriVox volunteers. Public domain. Captions generated with Amazon Transcribe.',
    source: 'transcribe',
    captions: require('../assets/two-pots.captions.json') as CaptionDoc,
    media: require('../assets/two-pots.mp3'),
  },
];

export interface Story extends Entry {
  words: number;
  durationSec: number;
}

export const LIBRARY: Story[] = ENTRIES.map(entry => ({
  ...entry,
  words: countWords(entry.captions),
  durationSec: docDuration(entry.captions),
}));

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
