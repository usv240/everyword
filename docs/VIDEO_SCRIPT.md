# Demo video script: EveryWord

Two minutes forty. Hard ceiling three minutes, and the rules say judges are
not required to watch past it, so nothing important lives after 2:00.

## What this script is built to do

Four judging criteria, each with a beat that lands early. The Fire TV rule
is specific: the video has to show the project running on an actual Fire TV
device or the Fire TV simulator, so that footage is not optional and it is
not left to the end.

| Criterion | Where it lands | The beat |
|---|---|---|
| Quality of the idea | 0:00 to 0:25 | Amazon ships this for books. No TV platform ships it for video. |
| Design | 0:25 to 0:55 | Watch the words light up. The product explains itself. |
| Tech implementation | 0:55 to 1:45 | Running on Fire TV, plus how any book becomes a read-along. |
| Potential impact | 1:45 to 2:40 | 200 million viewers, 32 points, four tenths of a cent per learner. |

## Before you record

```
npm test                              # 92 passing
npm run web:dev                       # or use the live site
node scripts/mcp-conform.mjs          # 19 of 19, live
```

**The Fire TV footage is the one thing you cannot fake.** Get it first, on
its own, before you record anything else:

1. Developer Console, Tools and Services, Appstore Quality Central
2. Virtual Devices, Get Started, accept the terms
3. Upload `everyword-tv-v0.1.0.apk` from the v0.1.0 release
4. Launch it, drive it with the D-pad, screen record 20 seconds of the
   words lighting up

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

> **"Same Language Subtitling is captions in the language you are already
> hearing, highlighted word by word, on ordinary entertainment."**

> **"It has run on Indian national television for twenty years. Two hundred
> million viewers. National broadcast policy since 2019. A five-year study
> of thirteen thousand people who could barely read found thirty-two
> percentage points more children became good readers."**

**Point at:** the highlight sweeping across the line.

> **"Amazon already ships this mechanic for books. It is called Immersion
> Reading. No television platform has ever shipped it for video."**

Pause. Then:

> **"EveryWord is that product."**

---

## 0:25 to 0:55 Watch it work

**Navigate to:** scroll to the player. **Press play on camera.**

**Point at:** the words as they light.

> **"Real public domain story, real audio, real captions from our pipeline.
> Every word lights at the moment it is spoken, so watching quietly
> becomes reading practice."**

**Point at:** the words-read meter.

> **"And this counts words the reader actually followed. Not minutes
> played. That is the only number here that measures reading."**

**Click:** read that line again.

> **"One button to hear a line again, because that is the thing a
> struggling reader wants most."**

---

## 0:55 to 1:20 On the television

**Cut to:** the Fire TV recording. Full screen.

> **"Here it is on Fire TV, sideloaded as an APK and driven by the remote.
> Same caption format, same renderer package, ten-foot layout."**

**Point at:** the D-pad navigation, then the highlight on the TV.

> **"The living room is where this belongs. A child watching a cartoon is
> getting reading practice and nobody had to sign them up for anything."**

---

## 1:20 to 1:45 How any book becomes a read-along

**Navigate to:** the terminal, or the story list showing both source types.

**Point at:** a story marked Transcribe, then one marked Polly.

> **"Two ways in. A human recording goes through Amazon Transcribe, which
> returns the timing of every word."**

> **"Or give it any public domain text and Amazon Polly reads it aloud and
> reports exactly when it said each word. Those captions cannot have the
> wrong word in them, because the words were known before they were
> spoken."**

> **"That second path means any book ever written can become a read-along."**

---

## 1:45 to 2:10 The measurement

**Navigate to:** the measured claim on the landing page, or docs/EVAL.md.

> **"We measured the part that is ours, against gold word alignments on
> speech we did not record."**

**Point at:** the 30 ms figure.

> **"The highlight lands within thirty milliseconds of the spoken word.
> That is about one frame of video."**

**Point at:** the zero.

> **"And it never lights a word early. Zero out of seven hundred and
> sixty-six. That is the one error a reading tool must never make, because
> a highlight that runs ahead teaches a child the wrong word."**

> **"We ran it again on the split LibriSpeech itself calls hard. Same
> thirty milliseconds. Same zero."**

---

## 2:10 to 2:25 The agent surface

**Navigate to:** the terminal.

> **"It is an Alexa+ surface too. A Model Context Protocol server with six
> tools, so a parent can ask out loud how much their child read this week
> instead of opening a dashboard."**

Run this if you have the seconds. The output prints
`12 of 12 MUST, 7 of 7 SHOULD`, which is the nineteen; know that before you
are on camera so you do not hesitate reading it.

```
node scripts/mcp-conform.mjs
```

> **"Nineteen of nineteen spec checks, live over real HTTP."**

**Point at:** the refusal, if you show one. Ask it about a word in the
story, then a word that is not.

> **"And when a reader asks about a word that is not in the story, it says
> so instead of inventing an answer. A reading tool that makes up a
> definition is worse than one that says it does not know."**

---

## 2:25 to 2:40 Close

**Cut back to:** the words lighting up. Let it play under the last lines.

> **"A hundred and thirty million American adults read below a sixth grade
> level. The technique that fixes it costs four tenths of a cent per
> learner and has twenty years of evidence behind it."**

> **"The renderer nobody had shipped is on npm tonight, MIT licensed."**

**Last frame:** a word lighting up.

> **"EveryWord. Watching becomes reading."**

---

## If you are over three minutes

Cut in this order:

1. The MCP conformance run at 2:10, say the sentence over the reader
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
