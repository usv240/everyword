import { describe, expect, it } from "vitest";
import {
  alignTokens,
  anchorRate,
  compareForm,
  cueWords,
  parseSubtitles,
  subtitleSpan,
  upgradeSubtitles,
  type RecognisedWord,
  type SubtitleCue,
} from "../src/index.js";

/**
 * Upgrading a subtitle track that already exists.
 *
 * This is the claim the product rests on, so these tests are written
 * against the ways it could quietly be false rather than against the
 * happy path.
 *
 * The promise has two halves and they are tested separately:
 *
 *   1. The displayed words are the subtitle author's, exactly, whatever
 *      the recogniser heard. If a recogniser mishearing could change a
 *      single character on screen, the "zero word error by construction"
 *      claim is marketing.
 *
 *   2. Every word is on screen during the line it belongs to, and the
 *      cursor only ever moves forward. This has to hold in the worst
 *      case, where the recogniser contributed nothing at all, because
 *      that is exactly when nobody is watching for it.
 */

const CUES: SubtitleCue[] = [
  { start: 1.0, end: 3.0, text: "There once was a thirsty crow." },
  { start: 3.2, end: 5.4, text: "He found a pitcher with a little water." },
];

/** A clean recognition pass: every word heard, on time. */
function perfectAsr(): RecognisedWord[] {
  const out: RecognisedWord[] = [];
  for (const cue of CUES) {
    const words = cueWords(cue.text);
    const step = (cue.end - cue.start) / words.length;
    words.forEach((w, i) => {
      out.push({
        w: w.replace(/[^A-Za-z']/g, ""),
        s: cue.start + i * step,
        e: cue.start + (i + 1) * step,
      });
    });
  }
  return out;
}

function allWords(doc: ReturnType<typeof upgradeSubtitles>) {
  return doc.segments.flatMap((s) => s.words);
}

describe("the words are the subtitle author's, not the recogniser's", () => {
  it("displays exactly the subtitle text, word for word", () => {
    const doc = upgradeSubtitles(CUES, perfectAsr());
    expect(doc.segments.map((s) => s.text)).toEqual([
      "There once was a thirsty crow.",
      "He found a pitcher with a little water.",
    ]);
    expect(allWords(doc).map((w) => w.w).join(" ")).toBe(
      "There once was a thirsty crow. He found a pitcher with a little water.",
    );
  });

  it("keeps the author's spelling when the recogniser mishears", () => {
    // The classic homophone. A recogniser reporting "their" must not be
    // able to put "their" on a child's screen.
    const asr = perfectAsr().map((w) =>
      w.w.toLowerCase() === "there" ? { ...w, w: "their" } : w,
    );
    const doc = upgradeSubtitles(CUES, asr);
    expect(allWords(doc)[0]!.w).toBe("There");
    expect(JSON.stringify(doc)).not.toContain("their");
  });

  it("keeps punctuation and capitalisation as written", () => {
    const doc = upgradeSubtitles(
      [{ start: 0, end: 2, text: "Wait! Don't, he said." }],
      [{ w: "wait", s: 0.1, e: 0.4 }, { w: "dont", s: 0.6, e: 0.9 }],
    );
    expect(allWords(doc).map((w) => w.w)).toEqual(["Wait!", "Don't,", "he", "said."]);
  });

  it("marks the document as aligned, so the provenance is not lost", () => {
    expect(upgradeSubtitles(CUES, perfectAsr()).source.kind).toBe("aligned");
  });
});

describe("every word lands inside its own line, always", () => {
  it("puts each word within the cue it came from", () => {
    const doc = upgradeSubtitles(CUES, perfectAsr());
    doc.segments.forEach((seg, i) => {
      const cue = CUES[i]!;
      for (const w of seg.words) {
        expect(w.s).toBeGreaterThanOrEqual(cue.start - 1e-6);
        expect(w.s).toBeLessThanOrEqual(cue.end + 1e-6);
      }
    });
  });

  it("never moves the cursor backwards", () => {
    const doc = upgradeSubtitles(CUES, perfectAsr());
    const words = allWords(doc);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]!.s).toBeGreaterThanOrEqual(words[i - 1]!.s - 1e-9);
    }
  });

  it("still works when the recogniser heard nothing at all", () => {
    // The worst case, and the one that matters: a noisy soundtrack, a
    // song, a language the recogniser does not have. The captions must
    // still be readable, just evenly spaced.
    const doc = upgradeSubtitles(CUES, []);
    const words = allWords(doc);
    expect(words).toHaveLength(14);
    doc.segments.forEach((seg, i) => {
      const cue = CUES[i]!;
      for (const w of seg.words) {
        expect(w.s).toBeGreaterThanOrEqual(cue.start - 1e-6);
        expect(w.e).toBeLessThanOrEqual(cue.end + 1e-6);
      }
    });
    for (let i = 1; i < words.length; i++) {
      expect(words[i]!.s).toBeGreaterThanOrEqual(words[i - 1]!.s - 1e-9);
    }
  });

  it("survives a recogniser that dropped half the words", () => {
    const asr = perfectAsr().filter((_, i) => i % 2 === 0);
    const doc = upgradeSubtitles(CUES, asr);
    expect(allWords(doc)).toHaveLength(14);
    for (const w of allWords(doc)) {
      expect(Number.isFinite(w.s)).toBe(true);
      expect(w.e).toBeGreaterThanOrEqual(w.s);
    }
  });

  it("survives a recogniser that invented words that were never said", () => {
    const asr = [
      ...perfectAsr(),
      { w: "umbrella", s: 2.0, e: 2.2 },
      { w: "helicopter", s: 4.0, e: 4.2 },
    ].sort((a, b) => a.s - b.s);
    const doc = upgradeSubtitles(CUES, asr);
    expect(allWords(doc).map((w) => w.w).join(" ")).toBe(
      "There once was a thirsty crow. He found a pitcher with a little water.",
    );
  });

  it("gives every word a duration the cursor can actually land on", () => {
    // Found on a real film. The recogniser anchored "fool" a few
    // milliseconds before its cue officially began, the two words ahead
    // of it were clamped to the cue's start, and all three came out at
    // the same instant. A zero-length word is on screen and never
    // highlighted, which tells a learning reader that word did not need
    // saying.
    const doc = upgradeSubtitles(
      [{ start: 18.0, end: 21.45, text: "You're a fool for traveling alone." }],
      [
        { w: "fool", s: 17.93, e: 18.2 },
        { w: "traveling", s: 18.45, e: 18.8 },
        { w: "alone", s: 18.82, e: 19.1 },
      ],
    );
    for (const w of allWords(doc)) {
      expect(w.e - w.s, `"${w.w}" has no duration`).toBeGreaterThan(0);
    }
  });

  it("gives the last word of a line a duration too", () => {
    // The same bug, one word further along: the final word's end is the
    // cue's end, so a start clamped onto the cue end left it zero
    // length. It survived the first fix because every word before it
    // was fine.
    const doc = upgradeSubtitles(
      [{ start: 0, end: 2, text: "almost out of time now" }],
      [{ w: "now", s: 1.99, e: 2.0 }],
    );
    const words = allWords(doc);
    expect(words[words.length - 1]!.w).toBe("now");
    for (const w of words) {
      expect(w.e - w.s, `"${w.w}" has no duration`).toBeGreaterThan(0);
    }
  });

  it("degrades evenly when a cue is too short for its own words", () => {
    // Two hundred milliseconds and six words. Nothing good is possible;
    // the requirement is that it stays ordered and nothing collapses.
    const doc = upgradeSubtitles(
      [{ start: 0, end: 0.2, text: "one two three four five six" }],
      [],
    );
    const words = allWords(doc);
    expect(words).toHaveLength(6);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]!.s).toBeGreaterThan(words[i - 1]!.s);
    }
  });

  it("tiles each line, so the cursor is never between words", () => {
    const doc = upgradeSubtitles(CUES, perfectAsr());
    for (const seg of doc.segments) {
      seg.words.forEach((w, i) => {
        const next = seg.words[i + 1];
        if (next) expect(w.e).toBeCloseTo(next.s, 6);
        else expect(w.e).toBeCloseTo(seg.end, 6);
      });
    }
  });
});

describe("the alignment itself", () => {
  it("anchors words that match and leaves the rest for interpolation", () => {
    const pairs = alignTokens(["a", "b", "c"], ["a", "x", "c"]);
    expect(pairs.map((p) => p.cue)).toEqual([0, 1, 2]);
    expect(pairs[0]!.rec).toBe(0);
    // 'b' against 'x' is a substitution: it keeps the shape of the
    // alignment but must not lend 'x' timing to 'b'.
    expect(pairs[1]!.rec).toBe(-1);
    expect(pairs[2]!.rec).toBe(2);
  });

  it("returns one pair per subtitle word even with no recognition", () => {
    expect(alignTokens(["a", "b"], []).map((p) => p.rec)).toEqual([-1, -1]);
  });

  it("reports how much of the track was actually anchored", () => {
    const full = anchorRate(CUES, perfectAsr());
    expect(full.words).toBe(14);
    expect(full.rate).toBeGreaterThan(0.9);
    const none = anchorRate(CUES, []);
    expect(none.anchored).toBe(0);
    expect(none.rate).toBe(0);
  });

  it("ignores case, punctuation and curly apostrophes when matching", () => {
    expect(compareForm("Don’t,")).toBe("don't");
    expect(compareForm("HELLO!")).toBe("hello");
    expect(compareForm("--")).toBe("");
  });
});

describe("reading the subtitle files that exist in the wild", () => {
  const SRT = [
    "1",
    "00:00:01,000 --> 00:00:03,000",
    "There once was",
    "a thirsty crow.",
    "",
    "2",
    "00:00:03,200 --> 00:00:05,400",
    "<i>He found a pitcher.</i>",
    "",
  ].join("\n");

  const VTT = [
    "WEBVTT",
    "",
    "NOTE this block carries no cue",
    "",
    "00:01.000 --> 00:03.000 line:90% align:middle",
    "There once was a thirsty crow.",
    "",
  ].join("\n");

  it("reads SubRip, joining a cue's wrapped lines", () => {
    const cues = parseSubtitles(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 1, end: 3, text: "There once was a thirsty crow." });
  });

  it("strips inline markup rather than reading it aloud as words", () => {
    expect(parseSubtitles(SRT)[1]!.text).toBe("He found a pitcher.");
  });

  it("reads WebVTT, including a missing hours field and cue settings", () => {
    const cues = parseSubtitles(VTT);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.start).toBe(1);
    expect(cues[0]!.text).toBe("There once was a thirsty crow.");
  });

  it("survives a byte-order mark and CRLF line endings", () => {
    const cues = parseSubtitles("﻿" + SRT.replace(/\n/g, "\r\n"));
    expect(cues).toHaveLength(2);
  });

  it("drops cues that carry no text or no duration", () => {
    const junk = [
      "1", "00:00:01,000 --> 00:00:01,000", "zero length", "",
      "2", "00:00:02,000 --> 00:00:03,000", "", "",
      "3", "00:00:04,000 --> 00:00:05,000", "kept", "",
    ].join("\n");
    expect(parseSubtitles(junk).map((c) => c.text)).toEqual(["kept"]);
  });

  it("returns cues in time order even when the file is not", () => {
    const shuffled = [
      "1", "00:00:04,000 --> 00:00:05,000", "second", "",
      "2", "00:00:01,000 --> 00:00:02,000", "first", "",
    ].join("\n");
    expect(parseSubtitles(shuffled).map((c) => c.text)).toEqual(["first", "second"]);
  });

  it("measures the span a file covers, for checking it matches the media", () => {
    expect(subtitleSpan(parseSubtitles(SRT))).toEqual({ start: 1, end: 5.4 });
    expect(subtitleSpan([])).toEqual({ start: 0, end: 0 });
  });

  it("parses a file and upgrades it end to end", () => {
    const doc = upgradeSubtitles(parseSubtitles(SRT), perfectAsr());
    expect(doc.segments).toHaveLength(2);
    expect(doc.segments[0]!.text).toBe("There once was a thirsty crow.");
    expect(doc.segments[0]!.words.length).toBeGreaterThan(0);
  });
});
