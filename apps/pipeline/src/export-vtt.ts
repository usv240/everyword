import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { toWebVTT, type CaptionDoc } from "@everyword/captions-core";

/**
 * Backfill standard WebVTT for every story already in the library, in both
 * plain and karaoke (inline timestamp tag) forms.
 *
 * Interop is the point: the EveryWord caption format carries word timings,
 * and WebVTT can express them, so content processed by this pipeline is
 * usable in any ordinary player and our format stays a superset rather
 * than a silo. See docs/BUILDER_TOOLS.md for why the Vega caption path
 * cannot render the karaoke form today.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(here, "../../web/public/content");

const manifest = JSON.parse(
  fs.readFileSync(path.join(CONTENT_DIR, "manifest.json"), "utf8"),
) as { items: Array<{ slug: string; captions: string; title: string }> };

for (const item of manifest.items) {
  const doc = JSON.parse(
    fs.readFileSync(path.join(CONTENT_DIR, item.captions), "utf8"),
  ) as CaptionDoc;
  const plain = toWebVTT(doc);
  const karaoke = toWebVTT(doc, { karaoke: true });
  fs.writeFileSync(path.join(CONTENT_DIR, `${item.slug}.vtt`), plain);
  fs.writeFileSync(path.join(CONTENT_DIR, `${item.slug}.karaoke.vtt`), karaoke);
  console.log(
    `${item.title}: ${doc.segments.length} cues, ${plain.length} bytes plain, ${karaoke.length} bytes karaoke`,
  );
}
