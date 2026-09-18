import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  computeWordIndex,
  countWords,
  docDuration,
  normalizeTranscribe,
  segmentWords,
  toWebVTT,
  transcribeItemsToWords,
  type CaptionDoc,
} from "@everyword/captions-core";
import { KaraokeCaptions, globalWordPosition, useWordIndex } from "../src/index";

/**
 * The README is an API claim, so it gets tested like one.
 *
 * These two packages are published to npm, which means their READMEs are
 * the first and often the only documentation anyone reads. A README that
 * names a prop the component does not have fails in the worst possible
 * way: no error, no warning, just a component frozen on the first word
 * while the reader wonders what they did wrong.
 *
 * That is not hypothetical. The first published README documented
 * `currentTime`, `index.at(t)`, `globalWordPosition(doc, currentTime)` and
 * four CSS variables that do not exist. Every one of them type-checked as
 * prose and every one of them was wrong, because they were written from
 * memory of the API rather than from the API. This file is the answer:
 * every name the README promises is asserted against what the package
 * actually exports, and the usage examples are executed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const README = fs.readFileSync(path.join(here, "../README.md"), "utf8");
const CORE_README = fs.readFileSync(
  path.join(here, "../../captions-core/README.md"),
  "utf8",
);

const doc: CaptionDoc = {
  version: "1.0",
  language: "en",
  source: { kind: "transcribe", generatedAt: "2026-09-18T00:00:00Z", model: "amazon-transcribe" },
  segments: [
    {
      id: 0,
      start: 0,
      end: 2.0,
      text: "the crow was thirsty",
      words: [
        { w: "the", s: 0, e: 0.4 },
        { w: "crow", s: 0.4, e: 0.9 },
        { w: "was", s: 0.9, e: 1.3 },
        { w: "thirsty", s: 1.3, e: 2.0 },
      ],
    },
  ],
};

const render = (time: number, className?: string): string =>
  renderToString(createElement(KaraokeCaptions, className ? { doc, time, className } : { doc, time }));

const activeWord = (html: string): string =>
  [...html.matchAll(/data-state="active"[^>]*>([^<]*)</g)].map((m) => m[1]!.trim()).join(",");

describe("the renderer does what its README says", () => {
  it("takes the prop the README names, and lights the right word", () => {
    // The exact bug that shipped: the README said currentTime, the
    // component takes time, and the mismatch is silent.
    expect(README).toContain("time={video.currentTime}");
    expect(activeWord(render(0.2))).toBe("the");
    expect(activeWord(render(0.6))).toBe("crow");
    expect(activeWord(render(1.0))).toBe("was");
    expect(activeWord(render(1.6))).toBe("thirsty");
  });

  it("never documents a prop the component does not accept", () => {
    // `currentTime` reads so naturally that it was written three times.
    // If it comes back, the component silently freezes on word one.
    expect(README).not.toMatch(/\bcurrentTime=/);
    expect(README).not.toMatch(/doc currentTime/);
  });

  it("references every CSS variable the theming section documents", () => {
    const documented = [...CORE_README.matchAll(/--kc-[a-z-]+/g)].map((m) => m[0]);
    const fromReadme = [...README.matchAll(/--kc-[a-z-]+/g)].map((m) => m[0]);
    expect(fromReadme.length).toBeGreaterThan(0);
    const html = render(0.6);
    for (const variable of new Set([...fromReadme, ...documented])) {
      expect(html, `${variable} is documented but never emitted`).toContain(variable);
    }
  });

  it("applies className and marks every word with a state, as documented", () => {
    const html = render(0.6, "captions");
    expect(README).toContain("data-state");
    expect(html).toContain('class="kc captions"');
    expect(html).toMatch(/data-state="(done|active|upcoming)"/);
  });

  it("exports every helper the API section lists", () => {
    expect(README).toContain("globalWordPosition(doc, wordIndex)");
    expect(README).toContain("useWordIndex(doc, time)");
    expect(typeof useWordIndex).toBe("function");
    expect(globalWordPosition(doc, computeWordIndex(doc, 1.0))).toBe(3);
  });

  it("documents the native entry with the props it actually has", () => {
    const native = fs.readFileSync(path.join(here, "../src/native.tsx"), "utf8");
    const documented = ["doc", "time", "style", "textStyle", "highlightColor", "highlightInk"];
    for (const prop of documented) {
      expect(README, `README documents ${prop}`).toContain(prop);
      expect(native, `native component accepts ${prop}`).toMatch(
        new RegExp(`\\b${prop}\\??:`),
      );
    }
  });
});

describe("captions-core does what its README says", () => {
  it("takes the time argument the README passes", () => {
    // The first version documented computeWordIndex(doc) followed by
    // index.at(t). There is no .at; the time is the second argument.
    expect(CORE_README).toContain("computeWordIndex(doc, currentTimeSeconds)");
    expect(CORE_README).not.toMatch(/index\.at\(/);
    const cursor = computeWordIndex(doc, 1.0);
    expect(cursor).toEqual({ segment: 0, word: 2, finished: false });
  });

  it("exports everything the API section lists", () => {
    for (const name of [
      "normalizeTranscribe",
      "computeWordIndex",
      "toWebVTT",
      "countWords",
      "docDuration",
      "transcribeItemsToWords",
      "segmentWords",
    ]) {
      expect(CORE_README, `${name} is listed`).toContain(name);
    }
    expect(countWords(doc)).toBe(4);
    expect(docDuration(doc)).toBe(2.0);
  });

  it("runs the WebVTT examples verbatim", () => {
    expect(CORE_README).toContain("toWebVTT(doc, { karaoke: true })");
    expect(toWebVTT(doc).startsWith("WEBVTT")).toBe(true);
    expect(toWebVTT(doc, { karaoke: true })).toContain("<00:00:00.400>");
  });

  it("accepts every normalize option the README shows", () => {
    const result = {
      results: {
        items: [
          { start_time: "0.0", end_time: "0.4", type: "pronunciation", alternatives: [{ content: "the" }] },
          { start_time: "0.4", end_time: "0.9", type: "pronunciation", alternatives: [{ content: "crow" }] },
        ],
      },
    };
    for (const option of ["maxChars", "maxGapSec", "maxDurSec", "tileGapSec"]) {
      expect(CORE_README, `${option} is documented`).toContain(option);
    }
    const normalized = normalizeTranscribe(result, {
      maxChars: 42,
      maxGapSec: 0.9,
      maxDurSec: 7,
      tileGapSec: 0.12,
    });
    expect(normalized.version).toBe("1.0");
    expect(normalized.segments.length).toBeGreaterThan(0);
    expect(transcribeItemsToWords(result)).toHaveLength(2);
    expect(segmentWords(transcribeItemsToWords(result), { maxChars: 42 }).length).toBeGreaterThan(0);
  });
});

describe("what the packages tell an installer", () => {
  it("both install lines name packages that exist on npm", () => {
    // Not a network check; a check that the install line matches the name
    // in package.json, which is what actually got published.
    const pkg = (p: string) =>
      JSON.parse(fs.readFileSync(path.join(here, p), "utf8")).name as string;
    expect(README).toContain(`npm install ${pkg("../package.json")}`);
    expect(CORE_README).toContain(`npm install ${pkg("../../captions-core/package.json")}`);
  });
});
