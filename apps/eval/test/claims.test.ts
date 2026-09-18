import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every number this project claims in public, checked against the evidence
 * that produced it.
 *
 * A figure in a README is a claim. A figure a test re-derives from the
 * committed evaluation output is a fact, and it cannot silently drift:
 * change the headline without re-running the evaluation, or re-run the
 * evaluation and get a different answer, and this file fails.
 *
 * For this project one claim matters more than the rest. "Never lights a
 * word early" is the difference between a reading tool and one that
 * teaches the wrong word, so it is asserted as an exact zero rather than a
 * threshold. If that number ever moves, the product's central promise has
 * changed and someone must say so out loud.
 *
 * Reproduce the underlying run: see docs/EVAL.md.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

const ls = JSON.parse(
  fs.readFileSync(path.join(repo, "apps/eval/results/librispeech.json"), "utf8"),
) as {
  reference: string;
  utterances: number;
  speakersApprox: number;
  goldWords: number;
  matchedWords: number;
  matchRatePercent: number;
  highlightOnset: { medianAbsMs: number; p90AbsMs: number };
  negativeControl: {
    earlyToleranceMs: number;
    wordsLitEarlyBeyondTolerance: number;
    ofMatchedWords: number;
  };
  lineBreaksOnRealPauses: {
    everyword: { breaks: number; onPausePercent: number };
    naiveFixedWidth: { breaks: number; onPausePercent: number };
  };
  linesOver42Chars: number;
};

/**
 * The harder split, run through the identical pipeline. The point of a
 * second number is that we did not get to choose the conditions: test-other
 * is the split LibriSpeech itself sets aside as difficult, with accents,
 * noisier recordings and speakers who appear nowhere in the clean split.
 */
const hard = JSON.parse(
  fs.readFileSync(path.join(repo, "apps/eval/results/librispeech-test-other.json"), "utf8"),
) as typeof ls & { split: string };

const PUBLIC_TEXT = [
  "README.md",
  "docs/SUBMISSION.md",
  "docs/EVIDENCE.md",
  "docs/EVAL.md",
  "docs/DESIGN.md",
  "docs/AWS.md",
  "docs/ACCESSIBILITY.md",
  "skills/everyword/SKILL.md",
].flatMap((f) => {
  const p = path.join(repo, f);
  return fs.existsSync(p) ? [{ file: f, text: fs.readFileSync(p, "utf8") }] : [];
});

const statedIn = (needle: string) =>
  PUBLIC_TEXT.filter((d) => d.text.includes(needle)).map((d) => d.file);

describe("the evaluation output is internally consistent", () => {
  it("matched words cannot exceed the gold words they were matched against", () => {
    expect(ls.matchedWords).toBeLessThanOrEqual(ls.goldWords);
    expect(ls.matchedWords).toBe(766);
    expect(ls.goldWords).toBe(788);
  });

  it("re-derives the match rate rather than trusting the stored field", () => {
    const derived = (ls.matchedWords / ls.goldWords) * 100;
    expect(Number(derived.toFixed(1))).toBe(97.2);
    expect(ls.matchRatePercent).toBe(97.2);
  });

  it("the negative control counts against every matched word", () => {
    // A zero is only meaningful if it was computed over the full set.
    expect(ls.negativeControl.ofMatchedWords).toBe(ls.matchedWords);
  });

  it("p90 onset error is not better than the median, which would be impossible", () => {
    expect(ls.highlightOnset.p90AbsMs).toBeGreaterThanOrEqual(ls.highlightOnset.medianAbsMs);
  });

  it("was evaluated against alignments we did not author", () => {
    // The whole point of an external corpus: the gold standard is someone
    // else's, so the numbers cannot be quietly favourable.
    expect(ls.reference).toMatch(/LibriSpeech/i);
    expect(ls.reference).toMatch(/not authored by us/i);
    expect(ls.speakersApprox).toBeGreaterThanOrEqual(20);
  });
});

describe("the promise that matters: never early", () => {
  it("lights zero words early beyond the 150 ms tolerance", () => {
    // Exact zero, deliberately. A highlight that runs ahead of the voice
    // teaches a learning reader the wrong word-sound pair, which is worse
    // than no highlight at all. If this ever becomes nonzero, the product
    // claim changes and a human has to decide what to say instead.
    expect(ls.negativeControl.wordsLitEarlyBeyondTolerance).toBe(0);
    expect(ls.negativeControl.earlyToleranceMs).toBe(150);
  });

  it("states that promise somewhere a reader can see it", () => {
    expect(statedIn("never lights a word early").length + statedIn("zero early-lights").length)
      .toBeGreaterThan(0);
  });
});

describe("every public claim matches the evidence", () => {
  it("is actually stated publicly, so this test is not vacuous", () => {
    expect(PUBLIC_TEXT.length).toBeGreaterThan(2);
    expect(statedIn("30 ms").length).toBeGreaterThan(0);
  });

  it.each([
    ["median onset error", ls.highlightOnset.medianAbsMs, "30 ms"],
    ["early tolerance", ls.negativeControl.earlyToleranceMs, "150 ms"],
    ["matched words", ls.matchedWords, "766"],
  ])("%s appears in public text exactly as the data says", (_label, value, formatted) => {
    expect(Number(String(formatted).replace(/[^\d.]/g, ""))).toBe(value);
    expect(statedIn(formatted).length).toBeGreaterThan(0);
  });

  it("no public file claims a median onset other than 30 ms", () => {
    const contradictions = PUBLIC_TEXT.filter((d) =>
      /(\d+) ms median onset/.test(d.text) && !/30 ms median onset/.test(d.text),
    );
    expect(contradictions.map((d) => d.file)).toEqual([]);
  });

  it("the line-break comparison beats the naive baseline it is compared against", () => {
    // EveryWord's clause-aware breaking is only worth claiming if it is
    // better than a fixed-width chunker at the same character budget.
    const ew = ls.lineBreaksOnRealPauses.everyword.onPausePercent;
    const naive = ls.lineBreaksOnRealPauses.naiveFixedWidth.onPausePercent;
    expect(ew).toBeGreaterThan(naive);
    expect(ew).toBe(42);
    expect(naive).toBe(2);
  });

  it("no caption line exceeds the 42 character budget the engine promises", () => {
    expect(ls.linesOver42Chars).toBe(0);
  });
});

/**
 * One number reads as a demo. The second one is the one that has to survive
 * a condition we did not pick.
 */
describe("the same pipeline on the split LibriSpeech calls hard", () => {
  it("is actually the harder split, with different speakers", () => {
    expect(hard.split).toBe("test_other");
    expect(hard.reference).toMatch(/test-other/);
    expect(hard.speakersApprox).toBeGreaterThanOrEqual(20);
  });

  it("still never lights a word early", () => {
    // The one promise that is not allowed to degrade. Accents and noise are
    // exactly the conditions under which a recognizer starts guessing, and
    // a guess that runs ahead of the voice teaches the wrong word.
    expect(hard.negativeControl.wordsLitEarlyBeyondTolerance).toBe(0);
    expect(hard.negativeControl.ofMatchedWords).toBe(hard.matchedWords);
    expect(hard.matchedWords).toBe(761);
  });

  it("holds its timing on harder audio", () => {
    expect(hard.highlightOnset.medianAbsMs).toBe(ls.highlightOnset.medianAbsMs);
    expect(hard.highlightOnset.p90AbsMs).toBeLessThanOrEqual(ls.highlightOnset.p90AbsMs * 1.5);
  });

  it("loses a little match rate, and says so rather than rounding it away", () => {
    // 96.7 against 97.2. Small, real, and in the direction the harder split
    // predicts. A second number identical to the first would be suspicious.
    expect(hard.matchRatePercent).toBeLessThan(ls.matchRatePercent);
    expect(hard.matchRatePercent).toBe(96.7);
  });

  it("still beats the naive chunker on line breaks", () => {
    expect(hard.lineBreaksOnRealPauses.everyword.onPausePercent).toBeGreaterThan(
      hard.lineBreaksOnRealPauses.naiveFixedWidth.onPausePercent * 5,
    );
  });

  it("is stated publicly, not just committed", () => {
    expect(statedIn("test-other").length + statedIn("test_other").length).toBeGreaterThan(0);
  });
});
