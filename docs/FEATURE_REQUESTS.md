# Feature requests

What we would want built, why it matters, and how urgent it is. Each comes from something we actually hit while building EveryWord, and each is cross-referenced to the friction log entry that produced it.

Urgency uses the hackathon's scale: **critical**, **important**, **nice-to-have**.

---

## Vega OS and Fire TV

### 1. A Windows host for the Vega Virtual Device, or a supported WSL2 path

**Critical.**

The Vega Developer Tools ship for macOS and Linux only; the documentation states Windows and WSL are neither supported nor tested. Windows is the most common desktop development platform, so this closes the Vega track to a large share of any hackathon's entrants before they write a line.

It compounds with a second fact that is nowhere stated together with the first: Vega OS is Linux-based rather than Android-based, so an existing Fire OS APK cannot simply be run on the Vega Virtual Device. Reaching Vega is a rebuild, not a re-run. Taken together, a Windows developer without a Fire TV device cannot satisfy **either** half of the submission requirement "an actual Fire TV device or the Fire TV/Vega simulator", no matter how much time they spend.

In priority order: a Windows host for the Virtual Device, or an officially supported WSL2 path. Failing that, a hosted or cloud-streamed Virtual Device, which would also help anyone on a locked-down corporate machine. Cheapest of all, say it loudly at the top of the Vega getting-started page rather than leaving it to be inferred from the absence of a Windows tab, and state plainly on the Fire TV landing page that Fire OS and Vega OS need different builds.

Friction log entry 12.

### 2. Word-level timing in the Vega caption path

**Important, and the reason this project exists.**

Vega's caption support is built on `VTTCue`, which is cue-level by specification: a block of text appears and disappears. It cannot express which word is being spoken right now.

That single gap is why EveryWord ships its own renderer rather than using the platform's. Same Language Subtitling, the intervention with two decades of national-scale evidence behind it, depends entirely on word-level highlighting; cue-level captions do not deliver it. Any TV platform that added a per-word timing channel to its caption pipeline would make a proven literacy intervention available to every app on it at once, rather than to every app that reimplements a renderer.

We would use it the day it existed, and we would delete code to do so.

### 3. A Windows caveats page for the React Native TV toolchain

**Important.**

Three separate hard failures cost most of a day, each with a non-obvious workaround, and all three are Windows-specific: `ninja` hitting `MAX_PATH` under an ordinary-length project folder; Metro then failing because it resolves realpaths and disagrees with the `subst` drive that is the standard workaround for the first problem; and a monorepo pulling in a second React copy that crashes the app with a null hook dispatcher until the parent copies are blocklisted.

Concretely: the React Native Gradle plugin could detect path-length risk at configure time and suggest `subst` or a shorter staging directory; Metro could realpath its roots and requests consistently so an alias of the project just works; and the monorepo docs could carry a recipe for exactly the shape we have, which is an app outside the workspaces sharing packages inside them. A one-page "Fire TV on Windows" document would have saved all three.

Friction log entries 3, 4 and 5.

---

## Amazon Polly

### 4. Word speech marks on the generative engine, or per-engine support in `describe-voices`

**Critical for this product category.**

The generative engine is the best-sounding one and refuses word-type speech marks entirely. So the product category that most needs both the best voice and word timings, which is reading tools, accessibility and karaoke captions, is exactly the one that cannot have both. We ship neural voices because we must, not because we chose them.

If supporting word marks on generative is infeasible, then at minimum expose per-engine speech-mark support in `describe-voices`, so a client can pick a voice correctly before making a request rather than discovering the refusal at runtime.

Friction log entry 7.

### 5. Document that speech-mark byte offsets are the source of truth, not the returned word

**Nice-to-have, and it would have saved a real bug.**

Speech marks return a normalized token that excludes attached punctuation, alongside byte offsets into the source text. A naive consumer renders the returned word and silently loses every comma, quotation mark and full stop. We slice the source text using the offsets instead, which recovers the author's exact text.

One paragraph in the speech marks guide, stating that the offsets are authoritative and the token is normalized, would prevent that class of bug outright. It is the difference between rendering a normalized token stream and rendering what the author wrote.

Friction log entry 8.

---

## Amazon Transcribe

### 6. A synchronous mode for short media

**Nice-to-have.**

Transcribe earned a rare positive entry in our friction log: word-level timestamps are part of every result with no configuration, and our measured 30 ms median onset error is its timing quality wearing our renderer. The only friction is operational. For a thirty-second audio file, `StartTranscriptionJob` plus a polling loop is a lot of ceremony for a result that will be ready in seconds.

Delivering the transcript directly in the response for short media would remove the poll loop for the common small-file case, which is most of what a captions pipeline processes.

Friction log entry 2.

---

## Amazon Devices Builder Tools

### 7. Make `init-context` work when stdin is not a TTY

**Critical for automation.**

`init-context` crashes with `ERR_USE_AFTER_CLOSE` when stdin is not a terminal, despite documented non-interactive flags. That blocks any scripted or CI setup, and the crash reads as a product failure rather than as a missing TTY, so the first thing a new user sees is a stack trace.

When stdin is not a TTY, take the documented flag values and safe defaults instead of prompting, and never surface `ERR_USE_AFTER_CLOSE` to a user. An explicit `--yes` would be welcome too.

Friction log entry 9.

### 8. Prompt for scope, and default to project rather than global

**Important.**

`init-context` offers only a global agent configuration change. That is a large blast radius for a tool being trialled, and it makes the tool unsafe to recommend inside a sample repository, because following the README changes a machine-wide setting.

Prompting for scope and defaulting to project would fix both.

Friction log entry 10.

### 9. Name the failing argument in MCP validation errors

**Nice-to-have, but it is per-call friction.**

`Invalid arguments provided for tool search_documentation` does not say which argument, nor hint that `target_platform` is a nested object rather than a string. We recovered by dumping the input schema from `tools/list`, which an agent can do and a human debugging by hand will not think to.

The same server already sets the bar: `set_project_context` returns `PROJECT_CONTEXT_REQUIRED` along with the exact call to make next, which is the best error message we saw anywhere in this hackathon. The validation errors should meet it.

Friction log entry 11.

---

## Model Context Protocol

### 10. Say in the transport section that real clients send `DELETE` with a JSON content-type and an empty body

**Important.**

Not in the spec text, and it cost two of our three projects a 500 error each. A naive body parser treats an empty body with `Content-Type: application/json` as a parse failure, and a test suite built on an injection helper never produces that shape, so it passes while real clients fail. One sentence in the session-termination section prevents it.

---

## What we are not asking for

Worth stating, because a list of requests reads better with a boundary.

We are not asking for a proprietary word-timing caption format. The right answer is a standard one, which is why our exporter emits plain WebVTT and karaoke WebVTT with inline timestamp tags rather than only our own JSON. If a platform adds per-word timing, we would rather it extended what already exists than invented something only that platform can read.
