import { describe, expect, it } from "vitest";
import {
  computeWordIndex,
  countWords,
  normalizeTranscribe,
  replayTarget,
  segmentWords,
  toWebVTT,
  transcribeItemsToWords,
  type CaptionDoc,
  type CaptionWord,
  type TranscribeResult,
} from "../src/index";

function w(text: string, s: number, e: number): CaptionWord {
  return { w: text, s, e };
}

/** Evenly timed words, 0.3s each, 0.05s gaps (sub-perceptual). */
function stream(texts: string[], startAt = 0): CaptionWord[] {
  return texts.map((t, i) => w(t, startAt + i * 0.35, startAt + i * 0.35 + 0.3));
}

describe("transcribeItemsToWords", () => {
  it("attaches punctuation to the previous word and keeps timing", () => {
    const result: TranscribeResult = {
      results: {
        items: [
          { type: "pronunciation", start_time: "0.0", end_time: "0.4", alternatives: [{ content: "The" }] },
          { type: "pronunciation", start_time: "0.45", end_time: "0.9", alternatives: [{ content: "fox" }] },
          { type: "punctuation", alternatives: [{ content: "." }] },
          { type: "pronunciation", start_time: "1.2", end_time: "1.6", alternatives: [{ content: "Then" }] },
        ],
      },
    };
    const words = transcribeItemsToWords(result);
    expect(words.map((x) => x.w)).toEqual(["The", "fox.", "Then"]);
    expect(words[1]!.e).toBe(0.9);
  });

  it("drops items with missing timing rather than corrupting the stream", () => {
    const result: TranscribeResult = {
      results: {
        items: [
          { type: "pronunciation", alternatives: [{ content: "ghost" }] },
          { type: "pronunciation", start_time: "0", end_time: "0.3", alternatives: [{ content: "real" }] },
        ],
      },
    };
    expect(transcribeItemsToWords(result).map((x) => x.w)).toEqual(["real"]);
  });
});

describe("segmentWords", () => {
  it("keeps a short utterance in one segment", () => {
    const segs = segmentWords(stream(["A", "quick", "brown", "fox."]));
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text).toBe("A quick brown fox.");
  });

  it("breaks on the 42 character line budget", () => {
    const segs = segmentWords(
      stream(["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india"]),
    );
    for (const s of segs) {
      expect(s.text.length).toBeLessThanOrEqual(42);
    }
    expect(segs.length).toBeGreaterThan(1);
  });

  it("prefers to end a line at punctuation (clause lookback)", () => {
    // Without lookback the overflow break lands mid-phrase after "began".
    const segs = segmentWords(
      stream(["It", "was", "a", "dark", "night.", "Then", "the", "reading", "began", "quietly"]),
    );
    expect(segs[0]!.text.endsWith("night.")).toBe(true);
    expect(segs[1]!.text.startsWith("Then")).toBe(true);
  });

  it("breaks on real silence", () => {
    const first = stream(["Hello", "there."]);
    const second = stream(["New", "thought."], 5);
    const segs = segmentWords([...first, ...second]);
    expect(segs).toHaveLength(2);
    expect(segs[1]!.start).toBe(5);
  });

  it("tiles sub-perceptual gaps so highlighting never flickers", () => {
    const segs = segmentWords(stream(["one", "two", "three"]));
    const words = segs[0]!.words;
    for (let i = 0; i < words.length - 1; i++) {
      expect(words[i]!.e).toBe(words[i + 1]!.s);
    }
  });

  it("leaves real intra-segment gaps alone", () => {
    const segs = segmentWords([w("slow", 0, 0.3), w("reader", 0.8, 1.1)]);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.words[0]!.e).toBe(0.3);
  });

  it("caps segment duration", () => {
    const drawn = [w("looong", 0, 3), w("paause", 3.5, 6.5), w("more", 6.9, 8)];
    const segs = segmentWords(drawn);
    expect(segs.length).toBeGreaterThan(1);
  });
});

describe("computeWordIndex", () => {
  const doc = normalizeTranscribe({
    results: {
      items: [
        { type: "pronunciation", start_time: "1.0", end_time: "1.3", alternatives: [{ content: "First" }] },
        { type: "pronunciation", start_time: "1.35", end_time: "1.7", alternatives: [{ content: "line" }] },
        { type: "punctuation", alternatives: [{ content: "." }] },
        { type: "pronunciation", start_time: "4.0", end_time: "4.3", alternatives: [{ content: "Second" }] },
        { type: "pronunciation", start_time: "4.35", end_time: "4.7", alternatives: [{ content: "line" }] },
      ],
    },
  });

  it("is before everything at t=0", () => {
    expect(computeWordIndex(doc, 0)).toEqual({ segment: -1, word: -1, finished: false });
  });

  it("finds the first word", () => {
    expect(computeWordIndex(doc, 1.1)).toMatchObject({ segment: 0, word: 0 });
  });

  it("keeps the last word lit during the breath pause between segments", () => {
    expect(computeWordIndex(doc, 3.0)).toMatchObject({ segment: 0, word: 1, finished: false });
  });

  it("advances into the second segment", () => {
    expect(computeWordIndex(doc, 4.4)).toMatchObject({ segment: 1, word: 1 });
  });

  it("reports finished after the end", () => {
    expect(computeWordIndex(doc, 10).finished).toBe(true);
  });

  it("handles seeking backward (pure recompute)", () => {
    expect(computeWordIndex(doc, 4.4).segment).toBe(1);
    expect(computeWordIndex(doc, 1.1).segment).toBe(0);
  });

  it("counts words for the exposure meter", () => {
    expect(countWords(doc)).toBe(4);
  });
});

describe("WebVTT export", () => {
  const doc = normalizeTranscribe({
    results: {
      items: [
        { type: "pronunciation", start_time: "1.0", end_time: "1.3", alternatives: [{ content: "First" }] },
        { type: "pronunciation", start_time: "1.35", end_time: "1.7", alternatives: [{ content: "line" }] },
        { type: "punctuation", alternatives: [{ content: "." }] },
      ],
    },
  });

  it("writes a valid plain WebVTT file", () => {
    const vtt = toWebVTT(doc);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.000 --> 00:00:01.700");
    expect(vtt).toContain("First line.");
    expect(vtt).not.toContain("<00:00:01.350>");
  });

  it("writes karaoke inline timestamps, first word untagged", () => {
    const vtt = toWebVTT(doc, { karaoke: true });
    expect(vtt).toContain("First <00:00:01.350>line.");
  });

  it("formats hours correctly for long media", () => {
    const long: typeof doc = {
      ...doc,
      segments: [{ id: 0, start: 3723.5, end: 3725, text: "late", words: [{ w: "late", s: 3723.5, e: 3725 }] }],
    };
    expect(toWebVTT(long)).toContain("01:02:03.500 --> 01:02:05.000");
  });
});

describe("replayTarget", () => {
  /* Sintel's shape: the film opens with seven seconds of music. */
  const doc: CaptionDoc = {
    source: { kind: "aligned" },
    segments: [
      { id: "s0", start: 7.25, end: 9.22, text: "a b", words: [
        { w: "a", s: 7.25, e: 8.2 }, { w: "b", s: 8.2, e: 9.22 }] },
      { id: "s1", start: 20, end: 22, text: "c d", words: [
        { w: "c", s: 20, e: 21 }, { w: "d", s: 21, e: 22 }] },
    ],
  } as unknown as CaptionDoc;

  it("has nothing to repeat before the first line", () => {
    // The bug: both readers seeked to 7.25 from here, which is forward.
    expect(replayTarget(doc, 0)).toBeNull();
    expect(replayTarget(doc, 5.83)).toBeNull();
    expect(replayTarget(doc, 7.24)).toBeNull();
  });

  it("returns the start of the line being read", () => {
    expect(replayTarget(doc, 7.25)).toBe(7.25);
    expect(replayTarget(doc, 8.5)).toBe(7.25);
    expect(replayTarget(doc, 21.4)).toBe(20);
  });

  it("gives back the line just finished during a pause between lines", () => {
    // A reader who missed a word asks for it after the line has ended.
    expect(replayTarget(doc, 15)).toBe(7.25);
  });

  it("never moves the media forward, at any time in the document", () => {
    // The property, rather than the three cases above: this is what the
    // label promises, and it is the invariant that was broken.
    for (let t = 0; t <= 25; t += 0.05) {
      const target = replayTarget(doc, t);
      if (target !== null) expect(target).toBeLessThanOrEqual(t);
    }
  });

  it("has nothing to repeat in an empty document", () => {
    expect(replayTarget({ ...doc, segments: [] } as unknown as CaptionDoc, 5)).toBeNull();
  });
});
