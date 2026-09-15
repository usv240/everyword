# Accessibility and quality audit

Measured, not asserted. Lighthouse 13.4.1 against the deployed reader at https://d34emfdcezeszz.cloudfront.net, headless Chrome, default mobile throttling.

This matters more here than in most projects. EveryWord is a reading-access product, so an inaccessible implementation would contradict the thesis.

## Results

| Category | Score |
|---|---|
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| Performance | 91 |

Reproduce:

```
npx lighthouse https://d34emfdcezeszz.cloudfront.net/ \
  --only-categories=accessibility,performance,best-practices,seo \
  --chrome-flags="--headless=new"
```

Accessibility scored 100 on the first run with no failures. Best practices scored 96 because of a 404 on every page load: no favicon existed at any conventional path, which also left a blank browser tab icon. Fixed with an `icon.svg`.

## The larger finding from the same audit

The audit prompted a check of what the page actually serves before JavaScript runs, and that found something worse than any Lighthouse item. The entire landing page, including the what, why and how explanation and all evidence links, was inside a `{!item || !doc ? loading : ...}` branch. None of it existed until the manifest and a caption document had loaded client-side. A visitor on a slow connection, or hitting any fetch failure, saw a hero and the words "Loading the story...".

The explanation has no dependency on a caption file. It now renders unconditionally, and only the library and reader stay behind the gate. This was a robustness and comprehensibility defect that no accessibility score would have caught.

## Reading-specific choices

These are design decisions the audit does not measure, made because the audience is people who find reading hard:

- Lexend is the body typeface, designed for reading proficiency rather than for brand.
- Text size is user-adjustable in the reader, and the karaoke highlight is themed through four CSS variables so a consumer of the package can meet its own contrast requirements.
- The highlight never flickers between syllables: sub-perceptual gaps are tiled, and during a pause the previous word stays lit rather than going dark, so a reader's eye is never left with nothing to hold.
- Slow mode preserves pitch, so slowing down does not distort the voice a learner is matching words to.
- Captions are exported as standard WebVTT, plain and karaoke, so the content works in players that have never heard of us.

## Known limit

Lighthouse checks the automatable minority of WCAG. It does not tell us whether the highlight timing is comfortable for a struggling reader, and our timing accuracy evaluation (30 ms median onset error, see EVAL.md) measures correctness rather than comfort. No assistive-technology user and no low-literacy reader has tested this build. Those are the claims we are not making.
