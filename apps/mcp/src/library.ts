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

/**
 * Load the library over HTTP from the deployed content directory.
 *
 * Used in Lambda. The point is that there is exactly one catalogue: the MCP
 * server reads the same manifest and the same caption documents that the web
 * reader and the Fire TV app serve, over the same CloudFront distribution.
 * An agent therefore cannot report a story the reader does not have, or a
 * word count the karaoke cursor disagrees with.
 */
export async function loadLibraryFromUrl(baseUrl: string): Promise<Story[]> {
  const base = baseUrl.replace(/\/$/, "");
  const manifest = (await fetchJson(`${base}/manifest.json`)) as {
    items: ManifestItem[];
  };

  return Promise.all(
    manifest.items.map(async (item) => {
      const doc = (await fetchJson(`${base}/${item.captions}`)) as CaptionDoc;
      const words = countWords(doc);
      const durationSec = docDuration(doc);
      return {
        slug: item.slug,
        title: item.title,
        attribution: item.attribution,
        words,
        durationSec,
        wordsPerMinute:
          durationSec > 0 ? Math.round((words / durationSec) * 60) : 0,
        narration: item.source,
        doc,
      };
    }),
  );
}

/**
 * Fetch with bounded retry.
 *
 * The library load happens once at cold start, and everything the MCP server
 * can answer depends on it. A single transient 5xx or a slow edge would
 * otherwise take the whole Alexa+ surface down until the container recycled,
 * so a handful of retries with backoff is worth far more here than it would
 * be on a per-request path.
 */
async function fetchJson(url: string, attempts = 3): Promise<unknown> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err as Error;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * 2 ** i));
      }
    }
  }
  throw new Error(`Failed to load ${url} after ${attempts} attempts: ${lastError?.message}`);
}

/**
 * Load the library, preferring the deployed content directory and falling
 * back to whatever is on local disk.
 *
 * The remote copy is authoritative because it is the one the reader serves.
 * But an MCP server that cannot start at all because a CDN had a bad minute
 * is worse than one running a catalogue that is a deploy behind: the tools
 * still answer, the numbers are still computed from real caption documents,
 * and the degradation is reported rather than hidden.
 */
export async function loadLibraryResilient(opts: {
  url?: string;
  contentDir?: string;
}): Promise<{ library: Story[]; source: "remote" | "local"; note?: string }> {
  if (opts.url) {
    try {
      return { library: await loadLibraryFromUrl(opts.url), source: "remote" };
    } catch (err) {
      try {
        return {
          library: loadLibrary(opts.contentDir),
          source: "local",
          note: `Remote catalogue unavailable (${(err as Error).message}); serving the bundled copy.`,
        };
      } catch {
        // Both failed: rethrow the remote error, which is the informative one.
        throw err;
      }
    }
  }
  return { library: loadLibrary(opts.contentDir), source: "local" };
}
