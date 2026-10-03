# Demo video script: EveryWord

**The beats are data, in [`video/beats.py`](../video/beats.py).** That file is what the
pipeline reads: the exact line spoken, which camera shoots it, and how
long it holds. This document is the argument for why those beats are in
that order. If the two disagree, the code is right and this is stale.

**Target 2:37. Hard ceiling 3:00.** `python video/beats.py` prints the
estimate and exits non-zero if the plan is already over. Judges are not
required to watch past three minutes, so the strongest material leads
and the headroom is left alone.

## The five ideas a judge should leave with

1. Subtitles know the line, not the word being spoken.
2. EveryWord adds word timing without changing a word the subtitle author wrote.
3. Here it is, working on a Fire TV.
4. Same-language highlighting on ordinary television has strong evidence of improving literacy.
5. EveryWord makes that mechanism reusable on video that already exists.

Everything else in the project (MCP, Bedrock, npm, LibriSpeech, privacy)
is proof for those five, and gets a sentence, not a section. The README
proves everything; the video's job is to make a judge want to open it.

| Criterion | Where it lands | The beat |
|---|---|---|
| Quality of the idea | 0:00 to 0:07 | Subtitles show what was said, not which word is being said. |
| Fire TV track and Design | 0:07 to 0:43 | Sintel lighting up on an Amazon-hosted Fire TV, a fable picked with the remote, the count on the card. |
| Tech implementation | 0:43 to 1:17 | Who decides the words and who decides the timing; two pipelines, one caption format. |
| Potential impact | 1:17 to 1:46 | Two decades on Indian television, 32 points, and why that transfers to existing video. |
| Tech implementation | 1:46 to 2:07 | Measured against gold alignments: 30 ms median, none early beyond 150 ms. |
| Design, for a parent | 2:07 to 2:16 | Five fields, no microphone. |
| Potential impact | 2:16 to 2:37 | The video they already chose becomes reading practice. Then black. |

## The beats

| # | Camera | Shows | Narration |
|---|---|---|---|
| 1 | Web | The site's before-and-after of one Sintel line | Subtitles show you what someone said. They don't show you which word they're saying right now. |
| 2 | Fire TV | Sintel playing, the words lighting one at a time, the whole console in frame | EveryWord does. This is a Fire TV, Amazon's hosted device, playing Sintel with the subtitles its makers shipped. EveryWord added the time of each word, and the film became reading practice. |
| 3 | Fire TV | The library on the remote; a fable opens and lights as it is read | Pick a story with the remote, and each word lights as it's spoken. |
| 4 | Fire TV | Back on the library, the words-read count on the card | The television also reports the words played to our MCP server, so an assistant can answer "how far did my child get today?" from playback activity the TV itself recorded. |
| 5 | Web | The two files the site serves, one line before and after | Amazon Transcribe never decides which words appear. The subtitle author did. Transcribe only says when to light them, so even if it mishears a word, it can't change what a child reads. |
| 6 | Web | The library's three source labels and "Three ways in, one caption format" | The demo is a film and five fables, but the system isn't tied to them. Give it a video with subtitles, and Amazon Transcribe adds the timing. Give it public-domain text, and Amazon Polly narrates and times it. Both produce the same word-level caption format. |
| 7 | Web | The "Why it exists" card, its numbers on screen while they are spoken | Karaoke-style subtitles ran on Indian national television for two decades, reaching an estimated two hundred million viewers. In a five-year study, thirty-two percentage points more children became good readers. |
| 8 | Web | The same card | It worked because nobody had to choose it: the practice rode programmes people already watched. EveryWord makes the idea programmable: upgrade the subtitles video already has, instead of producing special reading content. |
| 9 | Web | "Measured, not promised", the 30 ms and the zero | Against gold word alignments on speech we didn't record, the median timing error is thirty milliseconds, and in seven hundred and sixty-six words, not one lit more than a hundred and fifty milliseconds early. For a learning reader, lighting the next word too early creates the wrong word-to-sound match. |
| 10 | Web | What EveryWord knows about your child | And because it's designed for children, it keeps only five fields of reading-session data. There is no microphone. |
| 11 | Fire TV | Sintel lighting up again, then black | EveryWord doesn't ask anyone to open a reading app or change what they watch. It turns the video they already chose into reading practice. And because the caption engine and renderer are open source, other developers can bring the same experience to their own content. EveryWord. Watching becomes reading. |

## Wording that was changed on purpose

The script went through three outside review rounds. The changes that
matter for honesty:

- Beat 4 says **the words played**, not "what was read". The television
  records the words the playback cursor passed; it cannot know what a
  child took in, and the privacy section says the same.
- Beat 9 says **not one lit more than a hundred and fifty milliseconds
  early**, which is the measurement. An earlier draft said "never lights
  a word early", which the data does not support as stated.
- The $0.004 per learner figure is out of the narration. It is the cost
  of the Indian television programme, not of EveryWord, and it stays in
  docs/EVIDENCE.md where the attribution is beside it.
- The 130 million American adults are out of the close. The video is
  about children up to that point, and the close should not change who
  it is for in its last twenty seconds.
- The fables are not described as "read by LibriVox volunteers". One
  is; four are narrated by Amazon Polly from Project Gutenberg text.
- Beat 6 claims only what the pipeline does. No catalogue is implied.

## The footage

The Fire TV beats are the release APK (v0.3.2) running on an
Amazon-hosted Fire TV, a FOS 14 3P TV in Appstore Quality Central's Live
Device Interaction, driven with the console's remote. Nothing is
cropped: every television frame is the whole console page under an
address bar showing its real `developer.amazon.com` address, with the
device's name, the on-screen remote and the stream inside it, so a
viewer can see where the footage came from. Recorded 2026-10-03 at
twice device scale (3200x1800) and scaled 1.13x to fill the 4K frame.
The take claps a green square before the first beat and after the last,
and every mark is placed through the line between them, because
Chrome's recording of that page runs well behind the clock.

The web beats are the deployed site in a real browser at 3840x2160, with
an address bar drawn over the page so the live URL is on screen from
the first frame.

`video/README.md` has the pipeline. The device bug the take found,
Back quitting the app instead of returning to the library, is fixed in
v0.3.2 and recorded in `FRICTION_LOG.md`.
