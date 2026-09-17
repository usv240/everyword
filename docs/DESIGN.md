# Design

Why EveryWord looks and reads the way it does. Every principle is either from the shared design system used across all three of our projects in this hackathon, or from the specific constraint of this one: a product about reading access that is hard to read has refuted itself.

## The governing constraint: the reader may find reading hard

This is not a general audience. 58.9 million American adults score at PIAAC literacy Level 1 or below, up from 48 million in 2017 ([PIAAC Cycle 2](https://www.air.org/resource/report/highlights-us-piaac-cycle-2-results)). Someone at that level can read simple sentences and struggles with multi-step instructions.

So every design decision defers to legibility over polish:

- **Lexend** is the body typeface on reading surfaces, chosen because it was designed for reading proficiency rather than for brand character.
- **Text size is the reader's**, adjustable in the player, not a fixed value a designer preferred.
- **No decorative motion**, and `prefers-reduced-motion` is respected, because movement competes with the word being read.
- **Instructions are one clause long.** `Read that line again`, `Slow down`. A button that needs a sentence to explain it has failed this audience.

## The highlight is the product, so its correctness is a design property

A highlight that runs early teaches the wrong word-sound pair, which is worse for a learning reader than no highlight at all. That is not a performance concern; it is the difference between a reading tool and an anti-reading tool.

So the interface is built around three guarantees, each visible in behaviour:

- **Never early.** Measured: zero early-lights beyond 150 ms across 766 matched words, with 30 ms median onset error against gold alignments ([EVAL.md](EVAL.md)). The evaluation reports early-lights separately rather than folding them into a mean, because a mean would hide the only error that matters.
- **Never flickers.** Sub-perceptual gaps between words are tiled, so the highlight never blinks off between syllables.
- **Never leaves the eye with nothing.** During a pause the previous word stays lit; between lines the previous line stays visible. A reader's eye always has something to hold.

The third is the one a casual look would call a bug and a reader would call the difference between usable and not.

## Measure reading, not watching

The meter counts **words the cursor actually passed while the reader was present**, not minutes played. That distinction is the whole product, and it is why the number is small and specific rather than large and flattering.

Everything follows from it. There is no streak pressure, no badges, no gamification, no celebration when a story finishes. Same Language Subtitling works because it is *automatic and inescapable* practice inside entertainment people already want; a product that turns it into a chore with a scoreboard has broken the mechanism it is built on.

The meter is displayed quietly, in muted type, below the player. It is information, not a reward.

## Ten-foot UI is a different medium, not a scaled-up one

The Fire TV app is not the web reader with larger fonts. It is built for a person across a room holding a directional pad:

- Every control is D-pad focusable with a visible focus ring, because focus position **is** the cursor on a TV.
- Nothing requires a pointer, and `android.hardware.touchscreen` is declared not required, which is also what stops Fire TV filtering the app out.
- TV-safe margins on all sides, because televisions overscan.
- The karaoke renderer is the same package as the web (`karaoke-captions-react`), so the reading experience cannot drift between surfaces.

## Standard formats, not a silo

Captions export as plain WebVTT **and** karaoke WebVTT with inline timestamp tags, alongside our own JSON. The renderer is a standalone MIT package with four CSS variables for theming and no dependency on this repository.

This is a design decision, not a packaging one. A reading intervention that only works inside our app helps the people who find our app. The evidence base says the mechanic works; the useful thing to ship is the mechanic, in a form any video product can adopt.

## Progressive disclosure, and never mixing audiences

From the shared design system: the default reading path is entirely non-technical, and technical depth appears in exactly three sanctioned places, which are the "In technical terms" field of an info popover, the developer section, and the documentation.

This mattered here in a specific way: the landing page explains Same Language Subtitling to someone who has never heard of it, and the same page satisfies a judge reading for timing accuracy, because the measured numbers sit one click down rather than in the opening paragraph.

## Evidence sits beside every claim

Every statistic carries its source. Two of our own claims were corrected during a pre-submission audit when they did not survive checking, and the correction is recorded rather than quietly made ([EVIDENCE.md](EVIDENCE.md)). A literacy product citing literacy research should be checkable line by line.

## The whole case renders before any fetch

The landing page, the evidence, and the what-why-how exist in the prerendered HTML. This was not true at first: the entire page sat inside a loading branch, so a visitor on a slow connection saw "Loading the story..." and none of the argument. Explanation should never depend on a network call succeeding.

## Accessibility is a floor, not a goal

100 on Lighthouse accessibility, best practices and SEO. Keyboard operable throughout, visible focus rings, reduced motion respected, light and dark both real themes applied before first paint. The audit and its honest limits are in [ACCESSIBILITY.md](ACCESSIBILITY.md).

What Lighthouse cannot check is whether the highlight timing is comfortable for a struggling reader. Our evaluation measures correctness, not comfort, and no low-literacy reader has tested this build. That is stated rather than glossed.

## What we would change with more time

- **Test with actual developing readers.** Every decision above is reasoned from literature and measurement, not observed over someone's shoulder. It is the largest gap.
- **A reading-level signal on the library.** Narration pace in words per minute is exposed through the MCP server but not yet surfaced in the reader's own interface.
- **More languages.** The pipeline is English-only today, which is a hard limit on who this can serve, and the SLS evidence base is largely Hindi.
