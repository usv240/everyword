# Demo video script: EveryWord

**The beats are data, in [`video/beats.py`](../video/beats.py).** That file is what the
pipeline reads: the exact line spoken, which camera shoots it, and how
long it holds. This document is the argument for why those beats are in
that order. If the two disagree, the code is right and this is stale.

**Target 2:46. Hard ceiling 3:00.** `python video/beats.py` prints the
estimate and exits non-zero if the plan is already over. The estimate has
run about five seconds under the finished cut, so leave headroom.

## What this video has to do

Answer the obvious objection, which a good judge will have within twenty
seconds: *this idea already exists*.

It does. Same Language Subtitling has been running on Indian television
since 1996 and Amazon ships the same mechanic for books as Immersion
Reading. The video does not pretend otherwise; it names both. What it
argues instead is narrower and true:

1. The technique is proven, and it worked **because nobody chose it**.
   The practice rode programmes people were already watching.
2. Nobody has shipped it for video, for a concrete reason: every
   subtitle file in the world is line level, so there is nothing to
   light.
3. EveryWord closes exactly that gap, on content that already exists,
   and proves it on a film nobody here made.

A reading app does not inherit the Indian result. Upgrading the captions
on what a family was watching anyway does. That is the whole pitch, and
the **transfers** beat is where it lands, so nothing may be cut before
it.

| Criterion | Where it lands | The beat |
|---|---|---|
| Quality of the idea | 0:00 to 0:20 | Every video has subtitles. None have words. |
| Design | 0:20 to 0:45 | A real film, its own subtitles, lighting up. |
| Tech implementation | 0:45 to 1:05 | The same line before and after, from files you can open. |
| Fire TV track | 1:05 to 1:40 | Running on the device, driven by the remote. |
| Potential impact | 1:40 to 2:10 | 200 million viewers, 32 points, and why it transfers. |

## Never cut

The Fire TV footage (a track requirement), the film playing with words
lighting up (the product), the before-and-after panel (the evidence),
and the **transfers** beat (the argument). Everything else is negotiable.

## Before you record

```
npm test                              # 153 tests
npm run web:dev                       # or use the live site
node scripts/mcp-conform.mjs          # 19 of 19, live
```

**The Fire TV footage is the one thing you cannot fake.** Get it first, on
its own, before you record anything else:

1. Developer Console, Tools and Services, Appstore Quality Central
2. Virtual Devices, Get Started, accept the terms
3. Upload `everyword-tv-v0.3.1.apk`. This is the build that carries the
   film: it is 67.6 MB because Sintel is inside it, where v0.2.0 was
   41.7 MB and contained no video at all. If the file you are uploading
   is under 50 MB it is the wrong one, and the footage will show the old
   audio-only reader.
4. Launch it, open Sintel from the shelf, and screen record 20 seconds of
   the film playing with its own subtitles lighting up word by word.
   That shot is the submission. A fable reading aloud does not replace
   it, because the claim is about video nobody made for us.

If that farm is not reachable on your account, fall back to the Android
Virtual Device footage and say what it is, in one clause, out loud. Do not
let a judge discover it from the documentation.

Tabs, in order:

1. https://d34emfdcezeszz.cloudfront.net
2. Your Fire TV recording, ready to cut to
3. A terminal in the repo root

---

## 0:00 to 0:25 The idea

**Point at:** the landing page hero, already looping, words lighting up.

> **"Same Language Subtitling: captions in the language you are already hearing, highlighted word by word, on ordinary entertainment."**

> **"Twenty years on Indian national television. Two hundred million viewers. In a five-year study, thirty-two percentage points more children became good readers."**

**Point at:** the highlight sweeping across the line.

> **"Amazon already ships this for books, as Immersion Reading. No television platform has ever shipped it for video."**

Pause. Then:

> **"EveryWord is that product."**

---

## 0:25 to 0:55 Watch it work

**Navigate to:** scroll to the player. **Press play on camera.**

**Point at:** the words as they light.

> **"Real story, real captions from our pipeline. Every word lights as it is spoken, so watching becomes reading practice."**

**Point at:** the words-read meter.

> **"And this counts words the reader followed. Not minutes played. The only number here that measures reading."**

**Click:** read that line again.

> **"One button to hear a line again."**

---

## 0:55 to 1:20 On the television

**Cut to:** the Fire TV recording. Full screen.

> **"On Fire TV, sideloaded as an APK, driven by the remote. Same renderer, ten-foot layout."**

**Point at:** the D-pad navigation, then the highlight on the TV.

> **"This belongs in the living room. A child watching a cartoon gets reading practice and nobody signed them up for anything."**

---

## 1:20 to 1:45 How any book becomes a read-along

**Navigate to:** the terminal, or the story list showing both source types.

**Point at:** a story marked Transcribe, then one marked Polly.

> **"Two ways in: a human recording timed by Amazon Transcribe, or any public domain text read aloud by Amazon Polly, which reports when it said each word."**

> **"Those captions cannot contain a wrong word, because the words were known before they were spoken. Which means any book ever written can become a read-along."**

---

## 1:45 to 2:10 The measurement

**Navigate to:** the measured claim on the landing page, or docs/EVAL.md.

> **"We measured our part against gold word alignments, on speech we did not record."**

**Point at:** the 30 ms figure.

> **"The highlight lands within thirty milliseconds of the spoken word. About one frame of video."**

**Point at:** the zero.

> **"And it never lights a word early. Zero out of seven hundred and sixty-six. A highlight that runs ahead teaches a child the wrong word."**

> **"Again on the split LibriSpeech calls hard. Same thirty milliseconds. Same zero."**

---

## Cut from this video on purpose

The MCP server and the `explain_word` refusal used to sit here. They are
Alexa+ material, and this is the Fire TV video. Spending twenty-five
seconds on a second track pushed the whole thing past three minutes and
made the video about two things instead of one.

Both are in the README and the submission, where a judge who cares will
find them, and the conformance probe proves the claim without a camera:

```
node scripts/mcp-conform.mjs
```

## 2:10 to 2:30 Close

**Cut back to:** the words lighting up. Let it play under the last lines.

> **"A hundred and thirty million American adults read below a sixth grade level. This technique costs four tenths of a cent per learner."**

> **"The renderer nobody had shipped is on npm tonight, MIT licensed."**

**Last frame:** a word lighting up.

> **"EveryWord. Watching becomes reading."**

---

## If you are over three minutes

Cut in this order:

2. The read-that-line-again click at 0:25
3. The test-other sentence at 1:45

Never cut: the Fire TV footage, the words lighting up, or the zero. The
first is a track requirement, the second is the product, and the third is
the only claim that would make a teacher trust it.

## Upload checklist

- Under three minutes. Check the real duration, not your estimate.
- YouTube or Vimeo, **public**, not unlisted.
- English.
- No third-party music or footage you do not have rights to.
- Title and description name the Fire TV track.
- Paste the link into the Devpost submission and into `docs/SUBMISSION.md`,
  which currently says "add when published".

## Every number spoken here, and where it comes from

Live or committed as of recording. If anything changes before you shoot,
re-check it rather than trusting this table.

| Spoken | Source |
|---|---|
| 30 ms median, zero of 766 early | `apps/eval/results/librispeech.json` |
| Same on test-other, zero of 761 | `apps/eval/results/librispeech-test-other.json` |
| 19 of 19 spec checks | `node scripts/mcp-conform.mjs` |
| Six MCP tools | `apps/mcp/src/mcp.ts` |
| 200 million viewers, 32 points, $0.004 | UNESCO, cited in `docs/EVIDENCE.md` |
| 130 million adults below sixth grade | Gallup for the Barbara Bush Foundation, in `docs/EVIDENCE.md` |
| National broadcast policy since 2019 | `docs/EVIDENCE.md`, with citation |

## Things not to say

Do not say EveryWord has taught anyone to read. The thirty-two point
figure belongs to Indian television, not to this software, and the
submission is explicit about that line. Say the technique is proven and
the renderer is ours, and let the judge draw the rest.
