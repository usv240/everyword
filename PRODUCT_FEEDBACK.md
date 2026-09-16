# Product Feedback

Draft of the hackathon submission's product-feedback answer, maintained as we build so it reflects real experience. Format per the rules: what we used it for, what worked well, what needs work, how onboarding felt, whether we would build with it again.

## React Native for TV (react-native-tvos) and the Fire TV toolchain

- Used for: the EveryWord TV app: D-pad-driven karaoke reader sharing the renderer package with the web app.
- Worked well: the template ships genuinely TV-ready (LEANBACK_LAUNCHER present, focus engine works with plain Pressable); the shared-package model held once Metro was configured; the app ran on the Android TV emulator on first successful build.
- Needs work: the Windows path is rough for exactly the people a hackathon invites. Three separate failures cost most of a day: ninja MAX_PATH under a normal-length project folder, Metro versus subst-drive file identity, and monorepo duplicate React (FRICTION_LOG.md entries 3 to 5, each with the workaround).
- Onboarding: one command scaffolds a working TV project; the gap is a Windows caveats page.
- Build again: yes, with the friction log taped to the monitor.

## Amazon Transcribe

- Used for: every word timing in the product: the caption pipeline and the LibriSpeech evaluation.
- Worked well: word-level timestamps are simply part of every result; measured against gold forced alignments our end-to-end highlight lands at 30 ms median onset error with zero early-lights beyond 150 ms across 766 matched words (docs/EVAL.md). That number is Transcribe's timing quality wearing our renderer.
- Needs work: a synchronous small-file mode would remove the poll loop (FRICTION_LOG.md entry 2); sung or overlapping speech degrades timing, which shaped our dialogue-forward catalog policy.
- Onboarding: S3 in, JSON out, no tuning needed for read speech.
- Build again: yes; it is the load-bearing service of the project.

## AWS CDK, S3, CloudFront

- Used for: the reader's static hosting, deployed from one TypeScript file; the pipeline bucket.
- Worked well: bootstrap-then-deploy worked first try; origin access control and the index-rewrite function pattern are clean.
- Needs work: nothing significant at this scale.
- Build again: yes.

## Hugging Face datasets-server (evaluation infrastructure, third-party)

- Used for: fetching LibriSpeech utterances and gold alignments for the external evaluation.
- Worked well: rows API serves alignments and audio without downloading 300MB parquets.
- Needs work: truncated audio bodies arrive as HTTP 200 and silently poison downstream numbers; decode-validation on every file fixed it (FRICTION_LOG.md entry 6).

## Amazon Polly

- Used for: the second way into the caption format. Any public-domain text becomes a narrated read-along: Polly speaks it, and the word speech marks give us the timings. Four Aesop fables in the shipped catalog were produced this way with four neural voices.
- Worked well: speech marks return word timings **and** byte offsets into the source text, which is a stronger guarantee than recognition can ever offer. Because the words are known rather than transcribed, caption word error is zero by construction, not by measurement. That single property is what makes a whole public-domain library reachable without a human narrator.
- Needs work: two real limits. The generative engine, which is the best sounding one, refuses word-type speech marks entirely, so the product category that most needs both the best voice and word timings is exactly the one that cannot have both (FRICTION_LOG.md entry 7). And speech marks exclude attached punctuation, so a naive consumer renders "said" where the text reads "said," and loses every quotation mark; we recover it by slicing the source text with the byte offsets rather than trusting the returned word (entry 8).
- Onboarding: straightforward. One synthesis call for audio, one more with `SpeechMarkTypes` for timings, no job polling, no tuning.
- Build again: yes, and it changed the product's scope rather than just its implementation.

## Amazon Devices Builder Tools

- Used for: evaluating the Vega and Fire TV guidance before committing to a caption rendering approach, and checking our TV app against documented device best practice (docs/BUILDER_TOOLS.md).
- Worked well: the most valuable result was a negative one that saved us from a wrong turn. Its Vega captions documentation established that the platform's native caption path is built on `VTTCue`, which is cue-level only and cannot express word-level timing. That is precisely what EveryWord needs, so the answer justified our custom renderer with a citation instead of an assumption, and turned into a concrete platform feature request. The documentation search is genuinely faster than the public docs site for narrow questions like this.
- Needs work: three things cost real time. `init-context` crashes with `ERR_USE_AFTER_CLOSE` when stdin is not a TTY, despite documented non-interactive flags, which blocks any scripted or CI setup and reads as a product failure rather than a missing terminal (FRICTION_LOG.md entry 9). Its only offer is a global agent config change, which is a large blast radius for a tool being trialled (entry 10). And MCP argument validation errors do not name the missing argument, which is per-call friction on the two most used tools (entry 11). We worked around all three by speaking to the MCP server directly over stdio.
- Onboarding: installation is one command; the first guided workflow is where it breaks for anyone not on an interactive terminal.
- Build again: yes for the documentation and device knowledge, which are the parts that are hard to get elsewhere. The guided-workflow layer needs a non-interactive path first.

## Vega OS and the Vega SDK

- Used for: evaluated as a target for the TV app, then ruled out. Reported here because the reason is product feedback rather than a preference.
- What we found: the Vega Developer Tools ship for macOS and Linux only, and the docs state Windows and WSL are neither supported nor tested. This project was built on Windows, so the Vega Virtual Device was unreachable. Separately, Vega OS is Linux-based rather than Android-based, so an existing Fire OS APK cannot be run on the Vega Virtual Device to satisfy a "test on the simulator" requirement; reaching Vega is a rebuild, not a re-run.
- Why it matters: the Fire TV submission requirement names "an actual Fire TV device or the Fire TV/Vega simulator", and on Windows one of those two options does not exist. A developer with no Fire TV device and no Mac or Linux machine has no compliant path, which is a sharp edge on a track that otherwise says any framework is fine. FRICTION_LOG.md entry 12 has the detail and the suggestions.
- Onboarding: the documentation is clear and well organised once you are on a supported OS, and there is no allowlist or account gate, which is genuinely good. The gap is that the OS limitation is discoverable only by noticing the absence of a Windows tab.
- Build again: yes, on a Mac or a Linux box. Vega looks like the better long-term target for a caption renderer like ours, and we would want the `VTTCue` word-timing gap (docs/BUILDER_TOOLS.md) closed first.

## Still to record

- Amazon Appstore submission flow, once attempted.
- Fire OS behaviour on physical hardware, once a Fire TV device is available. See docs/FIRE_TV_TARGET.md for what our Android Virtual Device testing does and does not establish.
