import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countWords, docDuration, type CaptionDoc } from "@everyword/captions-core";

/**
 * The reading library, read from the same content directory the web reader
 * and the Fire TV app serve from. There is no second copy of the catalogue:
 * if a story is in the reader, it is in the agent, because both read this
 * manifest.
 *
 * Word counts and durations are recomputed from the caption documents
 * rather than trusted from the manifest, so the numbers an agent reports to
 * a parent are the same numbers the karaoke cursor is driven by.
 */

export interface ManifestItem {
  slug: string;
  title: string;
  attribution: string;
  media: string;
  captions: string;
  words: number;
  durationSec: number;
  source: string;
}

export interface Story {
  slug: string;
  title: string;
  attribution: string;
  /** Words in the caption document, counted from the document itself. */
  words: number;
  /** Duration in seconds, from the last word's end time. */
  durationSec: number;
  /** Narration pace in words per minute, the honest difficulty signal. */
  wordsPerMinute: number;
  /** How the narration was produced: "polly" or "librivox" etc. */
  narration: string;
  doc: CaptionDoc;
}

const DEFAULT_CONTENT_DIR = join(
  process.cwd(),
  "apps",
  "web",
  "public",
  "content",
);

export function loadLibrary(contentDir = DEFAULT_CONTENT_DIR): Story[] {
  const manifestPath = join(contentDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    items: ManifestItem[];
  };

  return manifest.items.map((item) => {
    const doc = JSON.parse(
      readFileSync(join(contentDir, item.captions), "utf8"),
    ) as CaptionDoc;
    const words = countWords(doc);
    const durationSec = docDuration(doc);
    return {
      slug: item.slug,
      title: item.title,
      attribution: item.attribution,
      words,
      durationSec,
      // Rounded to whole words per minute; a learner-facing pace, not a metric.
      wordsPerMinute: durationSec > 0 ? Math.round((words / durationSec) * 60) : 0,
      narration: item.source,
      doc,
    };
  });
}

/** The public shape of a story: everything except the caption document. */
export function describe(story: Story) {
  return {
    slug: story.slug,
    title: story.title,
    words: story.words,
    durationSeconds: Math.round(story.durationSec),
    wordsPerMinute: story.wordsPerMinute,
    narration: story.narration,
    attribution: story.attribution,
  };
}

/** The story's full text, one entry per display line, in reading order. */
export function storyLines(story: Story): string[] {
  return story.doc.segments.map((s) => s.text);
}
