# Evidence

Every impact claim EveryWord makes, with its source, stated precisely enough to check.

EveryWord is unusual among hackathon projects in that the intervention it implements has already been evaluated at national scale over two decades, by people who are not us. This file is the evidence for that, and it is also where one of our own overclaims is corrected.

## 1. The mechanism has more than 100 studies behind it

**More than 100 empirical studies document that captioning a video improves comprehension of, attention to, and memory for the video. Captions are particularly beneficial for people watching in a non-native language, for children and adults learning to read, and for people who are deaf or hard of hearing.**
Gernsbacher MA. Video Captions Benefit Everyone. *Policy Insights from the Behavioral and Brain Sciences*. 2015;2(1):195-202. [PMC5214590](https://pmc.ncbi.nlm.nih.gov/articles/PMC5214590/)

Stated precisely: the large evidence base is about comprehension, attention and memory, and the reading benefit is strongest for the groups still learning to read. We do not claim all 100 studies measure reading gains, because they do not.

## 2. The specific intervention has been measured at national scale, for five years

Same Language Subtitling (SLS) is same-language karaoke captioning applied to ordinary entertainment, so that reading practice arrives without anyone deciding to practise. It was conceived by Brij Kothari at the Indian Institute of Management Ahmedabad and has run on Indian national television since 1996.

**A five-year longitudinal impact study of the Rangoli programme sampled 13,000 people who initially could read a little or not at all.**

- The share who became good readers was higher among those exposed to SLS than the non-SLS group by **32 percentage points among children** and **9 percentage points among adults**.
- The share who remained illiterate was higher in the non-SLS group by **13 points among children** and **15 points among adults**.
- Newspaper reading among those exposed rose **from 33.7 percent at baseline to 70 percent five years later**.

Kothari B, Bandyopadhyay T (2014), as catalogued by the UNESCO Institute for Lifelong Learning: [Reading for a Billion: Same Language Subtitling, India](https://www.uil.unesco.org/en/litbase/reading-billion-same-language-subtitling-india).

**Cost per learner: $0.004.** Same source. Annual programme costs range from $150,000 for pilots to $2,000,000 for national scale-up. This is the number that makes the case for putting the mechanic in software rather than in a curriculum: the marginal cost of one more reader is rounding error, provided the captions already exist.

**Reach: SLS has been implemented on 10 programmes reaching an estimated 200 million viewers**, against an estimated 500 million early readers in India who could benefit. Same source.

**Policy outcome: SLS went from concept in 1996 to Indian national broadcast policy in 2019.** A government adopting the mechanic as an accessibility standard is a stronger external validation than any single study.

## 3. The audience is large, and in the United States it is growing

**In 2023, 28 percent of American adults, 58.9 million people, scored at Level 1 or below in literacy, up from 19 percent and 48 million in 2017. The average US adult literacy score fell 12 points over that period.**
OECD Programme for the International Assessment of Adult Competencies (PIAAC) Cycle 2, US results, reported by the [American Institutes for Research](https://www.air.org/resource/report/highlights-us-piaac-cycle-2-results) and [NCES](https://nces.ed.gov/fastfacts/display.asp?id=69).

Adults at Level 1 can comprehend simple sentences and short paragraphs but struggle with multi-step instructions or complex text. This is the population for whom a reading intervention that requires no class, no enrolment, no disclosure and no spare evening is the only one that will ever reach them.

That the number moved from 48 million to 58.9 million in six years matters for the "audience beyond the hackathon" question. This is not a stable problem being adequately served.

## 4. Why television, and why this is not already solved

The mechanic exists in Amazon's own catalogue for books: Immersion Reading and Read and Listen highlight text word by word in time with narration, and they work. No TV platform ships it for video. Ordinary video captions are cue-level: a block of text appears and disappears. They are legally mandated in many contexts and are genuinely useful, but they do not provide the word-level audio-to-text binding that the SLS evidence base rests on.

This is a platform-level gap rather than an oversight, and we verified it rather than assuming it. The Vega caption path is built on `VTTCue`, which is cue-level by specification and cannot express per-word timing. That finding came out of the Amazon Devices Builder Tools documentation and is recorded in [BUILDER_TOOLS.md](BUILDER_TOOLS.md). It is why EveryWord ships its own renderer, and why the renderer is a standalone MIT package rather than application code: the gap is the platform's, so the fix should be reusable by anyone.

## 5. What we measured ourselves

The evidence above says the intervention works when the highlighting is correct. Our own contribution is showing the highlighting can be made correct from commodity services, which is the part that decides whether this ships.

Against gold forced alignments from LibriSpeech, our end-to-end word highlight lands at **30 ms median onset error with zero early-lights beyond 150 ms across 766 matched words**. The Polly path is stronger still: because the words are known rather than recognized, caption word error is zero by construction rather than by measurement. Method, limits and the reproduction command are in [EVAL.md](EVAL.md).

Timing accuracy matters for a reason specific to this intervention. A highlight that runs early teaches the wrong word-sound pair, which is worse for a learning reader than no highlight at all. That is why the evaluation reports early-lights separately rather than folding them into a mean error.

## Correction made during this audit

We wrote that SLS delivers reading practice "to more than 200 million weak readers." The sourced figure is 200 million **viewers** across 10 programmes, which is not the same claim: not every viewer is a weak reader. The corrected framing appears above and in the README. The separate figure for the size of the addressable population, 500 million early readers in India, is reported by UNESCO as a potential rather than a reach.
