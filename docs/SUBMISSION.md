# Devpost Submission: EveryWord

Paste-ready copy for each Devpost field. Keep the first two sentences intact; they carry the measured claim and the precedent that frames the whole project.

---

## Tagline (one line)

EveryWord takes any video or audio, times every word with Amazon Transcribe, lights each word at the instant it is spoken, and turns watch time into reading practice.

---

## What it does (project description)

**Measured against gold-standard forced alignments on LibriSpeech (speech we did not record, 27 speakers, 788 reference words), EveryWord's highlight lands within 30 milliseconds of the spoken word at the median, never lights a word early beyond 150 milliseconds across 766 matched words, and breaks caption lines at real pauses 42 percent of the time where timing-blind chunking manages 2 percent.**

**Run again on test-other, the split LibriSpeech sets aside as hard, with 26 different speakers, accents and noise: the same 30 millisecond median, the same 85 millisecond p90, and still zero words lit early across 761 matched words.** The match rate slips from 97.2 to 96.7 percent, which is the direction a harder split predicts and is reported rather than rounded away.

Thirty milliseconds is about one frame of video: a reader cannot perceive the voice and the highlight as separate events. The zero is the number that matters for a learner, because a reading tool must never claim a word was spoken before it was.

Fifty-four percent of American adults, about 130 million people, read below a sixth-grade level, and children surrounded by adults with low literacy are 72 percent more likely to struggle themselves. Nobody has money or time for tutoring. Everyone has a screen.

The most proven literacy intervention almost nobody in the West has heard of is Same Language Subtitling: subtitles in the same language as the audio, highlighted word by word, karaoke style, on ordinary entertainment. Conceived by Brij Kothari at IIM Ahmedabad and running on Indian national television since 1996, it reaches an estimated 200 million viewers across 10 programmes and became Indian national broadcast policy in 2019.

It is measured, not merely deployed. A five-year longitudinal study of 13,000 people who could initially read a little or not at all found that the share becoming good readers was 32 percentage points higher among children exposed to SLS than among those not, and 9 points higher among adults, with newspaper reading rising from 33.7 percent to 70 percent. The cost is $0.004 per learner (Kothari and Bandyopadhyay 2014, catalogued by the UNESCO Institute for Lifelong Learning). Separately, more than 100 empirical studies find captions improve comprehension, attention and memory, with people learning to read among those who gain most (Gernsbacher, *Policy Insights from the Behavioral and Brain Sciences*, 2015).

The audience is not shrinking. In 2023, 28 percent of US adults, 58.9 million people, scored at PIAAC literacy Level 1 or below, up from 48 million in 2017. Every figure here is sourced in [EVIDENCE.md](EVIDENCE.md), including one claim of our own that was corrected during a pre-submission audit.

No TV platform has ever shipped it. Meanwhile Amazon already ships exactly this mechanic for books: Immersion Reading, expanded in February 2026 with Read and Listen in the Audible app, highlights each word as the narrator speaks it.

**EveryWord is Immersion Reading, for television.**

Watch the reader: a real public-domain Aesop fable read by LibriVox volunteers, captions generated automatically by our pipeline, each word lighting as it is spoken. Press "Read that line again" to hear a line once more. Slow it down with pitch preserved. Change the type size, or switch to a reading-optimized typeface. A meter counts the words you read along with, quietly, with no gamification. The same renderer runs on the Fire TV app, and the release ships a self-contained APK you can sideload onto a Fire TV stick.

---

## How we built it

Four pieces, each open source under MIT:

- **`@everyword/captions-core`**: the open caption format (docs/FORMAT.md) and the engine. It normalizes Amazon Transcribe word timings into readable lines: a 42-character budget, clause-aware line breaks that prefer to end a line at punctuation rather than mid-phrase, silence and duration breaks, and sub-perceptual gap tiling so the highlight never flickers between syllables. The karaoke cursor is pure binary-search math with reading-first semantics: during a pause the previous word stays lit, and between lines the previous line stays visible, so a reader's eye is never left with nothing to hold.
- **`karaoke-captions-react`**: the renderer, split out as a standalone MIT-licensed package and [published on npm](https://www.npmjs.com/package/karaoke-captions-react) so any video app can adopt it. Caption document plus a playback `time` in, highlighted line out, themed with four CSS variables, with an `onWordsRead` callback that drives reading-exposure meters. The web reader and the Fire TV app import the same package. Its engine ships alongside it as [`@everyword/captions-core`](https://www.npmjs.com/package/@everyword/captions-core).
- **The pipeline**: media in, captions out. S3 upload, an Amazon Transcribe job with word-level timestamps, normalization, then media plus captions plus a manifest entry written into the reader's content directory. Adding a new story is one command.
- **The apps**: a static Next.js reader on S3 and CloudFront, and a React Native TV app (react-native-tvos) targeting **Fire OS**, with a proper 10-foot UI: D-pad focusable controls, visible focus rings, TV-safe margins, nothing requiring a pointer. It ships as a sideloadable APK. No physical Fire TV was available, so it was tested on an Android Virtual Device, which is Amazon's own documented method for emulating an Amazon device; docs/FIRE_TV_TARGET.md states precisely what that establishes and what it does not, and why Vega OS was not a reachable target from Windows.

**The evaluation** samples LibriSpeech dev-clean utterances at fixed offsets, decode-validates every download, stitches them with tracked offsets, runs one production-identical Transcribe pass, and aligns hypothesis words to gold words by edit distance, scoring only exact token matches so recognition errors can never flatter the timing numbers. The line-quality comparison judges every internal break against the gold pause structure, against a greedy fixed-width chunker at the same character budget. Method and measured limits are in docs/EVAL.md; one command reproduces the run.

---

## Challenges we ran into

The first evaluation run reported an 11.5 percent word match and nonsense timings. Nothing had errored: several dataset audio downloads had arrived truncated with HTTP 200, silently shifting the stitched timeline. Decode-validating every file took the match rate to 97.2 percent and became friction log entry 6, and it is the lesson we would most want another team to steal.

The Windows path to a working Fire TV build produced three more entries. The native build fails with a MAX_PATH error because codegen object paths embed the full project path, and a folder named after this hackathon is long enough to trigger it. The standard workaround, a subst drive, then breaks Metro, which resolves realpaths back to the original spelling and cannot find its own files. And sharing packages across a monorepo pulled in a second React that crashed the app with a null hook dispatcher until the parent copies were blocklisted outright.

---

## What we learned

The mechanic is twenty-five years old and the evidence is overwhelming; what was missing was never the idea, it was an automatic word-timing pipeline cheap enough to run on any video. That now costs about two cents a minute.

---

## What's next

A library of read-along stories, a word-tap dictionary, and the argument this project exists to make: that platforms can turn this on now, and Amazon can do it first because it already built the mechanic for books.

---

## Potential impact (the economics)

**This intervention has a measured cost per learner: $0.004.** Four tenths of one cent, from UNESCO's catalogue of a five-year study of 13,000 initially-weak readers that found 32 percentage points more children became good readers than in the unexposed group.

Set that against the problem: 54 percent of US adults aged 16 to 74, about 130 million people, read below a sixth grade level, at an estimated cost to the economy of **$2.2 trillion a year** (Gallup for the Barbara Bush Foundation, 2020). The number at the lowest PIAAC level grew from 48 million to 58.9 million between 2017 and 2023. This is not a stable problem being adequately served.

At four tenths of a cent, the intervention does not need to work often to be worth doing. The reason it is not already everywhere is not the idea, which is twenty-five years old, but the absence of **an automatic word-timing pipeline cheap enough to run on arbitrary video.** Ours costs about **two cents per minute** of media, so a ninety-minute film becomes word-timed reading practice for roughly $1.80, once, for every future viewer of it.

We do not claim EveryWord has taught anyone to read. The 32-point figure belongs to Indian television, not to this software. What is ours is the pipeline and the renderer, and the part we measured is timing: 30 ms median onset error with zero early-lights beyond 150 ms, because a highlight that runs early teaches the wrong word. Full chain in [EVIDENCE.md](EVIDENCE.md) section 6.

## Product feedback (required field)

See PRODUCT_FEEDBACK.md in the repository for the full version. Amazon Transcribe is the load-bearing service and it earned a rare positive friction-log entry: word-level timing is part of every result with no configuration, and our measured 30 ms median onset error is that timing quality wearing our renderer. A synchronous small-file mode would remove the polling loop. React Native for TV ships a genuinely TV-ready template, but the Windows developer path needs a caveats page: three separate hard failures (MAX_PATH in the native build, Metro versus subst file identity, monorepo duplicate React) cost most of a day and each has a non-obvious workaround. On AWS we used Transcribe (every word timing, in both the pipeline and the evaluation), S3 (media staging and the site bucket), CloudFront (delivery with origin access control and an index-rewrite function), and CDK (the stack); details in docs/AWS.md.

---

## Friction log (optional, judged bonus)

Thirteen entries in FRICTION_LOG.md, each with task, steps, expected versus actual, severity, workaround, and an actionable suggestion. The ones we would most want read: the Vega SDK has no Windows or WSL support, which combined with Vega OS being Linux-based rather than Android-based leaves a Windows developer with no way to satisfy the "Fire TV/Vega simulator" option at all (entry 12); Polly's best-sounding engine refuses word speech marks, so the product category that most needs both the best voice and word timings cannot have both (entry 7); Builder Tools `init-context` crashes when stdin is not a TTY despite documented non-interactive flags, which blocks any scripted setup (entry 9). There is also a deliberately positive entry for Amazon Transcribe's first-run experience, three Windows Fire TV build failures, and a dataset-integrity lesson that was our own fault and is recorded anyway. Entry 13 is against us too: our own deployed MCP server answered a malformed body with an HTTP 500 where JSON-RPC calls for a -32700 parse error, and thirty-five in-process tests passed while the live server was wrong.

---

## Built during the hackathon

This project did not exist before the submission window. The first commit
is 2026-09-14 and the whole repository is public history: every file, every
number and every correction was written for this hackathon.

Nothing here was adapted from earlier work, so the rules' question about
what changed during the window has the simplest possible answer, which is
all of it.

## Tracks and mini challenges

Fire TV and Alexa+. AWS Builder and Open Source mini challenges.

The rules cap winnings rather than entries: "each project can only win one track prize and one mini challenge prize."

**Alexa+** is not a stretch here. The track asks for a self-hosted MCP server implementing spec 2025-11-25 over Streamable HTTP, and `apps/mcp` is exactly that, deployed and live at https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp. EveryWord measures how many words a reader actually followed on screen, which is not minutes played and is the one number no other reading tool has. Sitting in a database it is useless, because the adult who cares about it asks out loud rather than opening a dashboard. The screen does the reading practice; the agent does the noticing. Six tools, including `explain_word`, which explains a word a reader is stuck on through a three-model Bedrock ladder, grounded in the sentence it appears in, and refuses words not in the story rather than guessing. Reading sessions persist in DynamoDB as an append-only log from which every reported number is derived. Nothing fails into silence: the catalogue load retries and falls back to a bundled copy, the model ladder falls to the reader's own sentence, and `GET /api/resilience` reports every degradation path. Thirty-six conformance and behaviour tests, and a Strands agent in `apps/agent` consumes the server as an independent outside client, verified live against the deployed endpoint.

**Fire TV** is the reader's home: a react-native-tvos app targeting Fire OS, shipped as a sideloadable multi-architecture APK. See docs/FIRE_TV_TARGET.md for the target, the test environment, and the honest limits of both.

Both tracks are shown on the live site rather than only described. **What EveryWord knows about your child** is five fields and no microphone: the section names the literal row `record_reading_session` writes and lists what the product never has, starting with audio, because there is no `getUserMedia`, `MediaRecorder` or `AudioRecord` anywhere in the web app, the TV app or the server. It reads *to* a child and follows its own cursor, so it never needed the ability to hear one. **The questions a parent asks** answers the uncomfortable ones plainly, including that this will not teach a child to read on its own and that it has not run on physical Fire TV hardware. **On your Fire TV** carries a screenshot of the release APK driven by D-pad, the four real steps to sideload it onto your own Fire TV with `adb`, a download link, and a status list that marks physical Fire TV hardware as *not yet* instead of letting a green badge imply it. **Ask Alexa+ for a story** runs a complete MCP session from the visitor's own browser against the deployed server: protocol 2025-11-25 agreed, the handshake finished, six tools listed, `recommend_story` called for something under five minutes, and the session closed with a 204. Every row is the server's own answer.

Building that panel found two real defects, both fixed and pinned in `apps/mcp/test/cors.test.ts`. The server's Origin allowlist was loopback only, which is right for a local server and refused the project's own deployed site with a 403, so the page that exists to show the Alexa+ integration could not reach it; it now admits loopback plus explicitly named origins and still refuses look-alikes such as `...cloudfront.net.evil.com`. And the local CORS layer never exposed `MCP-Session-Id`, so a browser could not read the session the server had just opened; production only worked because the function URL exposed it. Agents never saw either problem, because they send no Origin and are not browsers.

## Open source

- Repository: https://github.com/usv240/everyword (MIT, visible in About)
- GitHub username: usv240
- Contributions: https://www.npmjs.com/package/karaoke-captions-react and https://www.npmjs.com/package/@everyword/captions-core

**Two new MIT packages, both on npm.**

`karaoke-captions-react` is the renderer: a word-timed caption document and a playback time in, a highlighted line out, themed with four CSS variables, with an `onWordsRead` callback that drives reading-exposure meters. It ships a React Native entry too, which is what runs on the Fire TV.

`@everyword/captions-core` is the engine underneath it: the open caption format, an Amazon Transcribe normaliser with clause-aware line breaks and gap tiling, a standard WebVTT exporter in both plain and karaoke modes, and the binary-search word-index math that drives the cursor.

They matter because Same Language Subtitling is one of the most proven literacy interventions ever measured and no video platform ships the renderer for it. Anyone can now `npm install` it. Splitting the engine out is what makes the caption format a format rather than our file layout, and the WebVTT exporter is what keeps it a superset of a standard rather than a silo.

Both are the same code the web reader and the Fire TV app import, not copies made for the submission, and the README of each is tested as an API claim.

## AWS Builder

Amazon Transcribe (word-level timings, in both the caption pipeline and the evaluation), Amazon Polly (the second pipeline, narrating any public-domain text with zero word error by construction), Amazon Bedrock (a three-model ladder behind `explain_word`, falling back to the reader's own sentence), the Strands Agents SDK (an agent consuming our own MCP server), DynamoDB (reading sessions as an append-only log, every figure derived on read), Lambda with a function URL, S3, CloudFront and CDK. Each with its reason in [AWS.md](AWS.md).


---

## Links

- Demo video (under 3 minutes): YouTube link, add when published. Shot list with pre-flight commands: docs/VIDEO_SCRIPT.md
- Live reader: https://d34emfdcezeszz.cloudfront.net
- Fire TV APK and demo footage: https://github.com/usv240/everyword/releases/tag/v0.1.0
- MCP server (Alexa+ surface), live: https://bgvgejdhfhlu2inavg23d5dkj40eggxt.lambda-url.us-east-1.on.aws/mcp
- Fire TV target platform and test environment: docs/FIRE_TV_TARGET.md
- Evidence for every impact claim: docs/EVIDENCE.md
- Design reasoning: docs/DESIGN.md
- Feature requests (optional field): docs/FEATURE_REQUESTS.md
- Accessibility audit (100 accessibility, 100 best practices, 100 SEO): docs/ACCESSIBILITY.md
- Repository (MIT): https://github.com/usv240/everyword
- Evaluation: https://github.com/usv240/everyword/blob/main/docs/EVAL.md
- Caption format spec: https://github.com/usv240/everyword/blob/main/docs/FORMAT.md
