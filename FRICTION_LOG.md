# Friction Log

Format per entry: task attempted, steps taken, expected vs actual, severity (low, medium, high), workaround, actionable suggestion. Entries are written the day they happen; this log is part of the hackathon submission.

## Entry 1: Turbopack monorepo root inference fails silently useful (2026-09-14)

- Task: build the Next.js reader app that imports two workspace packages.
- Steps: standard create-next-app scaffold inside an npm-workspaces monorepo, transpilePackages configured, next build.
- Expected: the build resolves workspace packages via the symlinks npm creates.
- Actual: Turbopack rooted the build at apps/web instead of the monorepo root and refused to compile files outside it ("To ensure a hermetic build... files outside of the workspace root are not compiled"). The error does name the resolution root and links the docs, which made this quick to fix; it still costs every monorepo user one failed build.
- Severity: low.
- Workaround: `turbopack: { root: path.join(here, "../..") }` in next.config.ts.
- Suggestion: when a parent directory contains a lockfile with a workspaces field that includes the app, prefer that directory as the root automatically.

## Entry 2: Amazon Transcribe first-run experience was genuinely good (2026-09-14)

- Task: word-level timestamps for a 112 second public-domain mp3 (the core of the EveryWord pipeline).
- Steps: S3 upload, StartTranscriptionJob with defaults, poll, fetch the transcript JSON.
- Expected: some assembly required.
- Actual: word-level timing is simply part of every result (pronunciation items with start_time and end_time, punctuation as separate items), the job on a 2 minute file completed in about 90 seconds, and timing accuracy was good enough to drive karaoke highlighting with no manual correction on first attempt. Logging it because feedback should include what worked.
- Severity: none (positive entry).
- Suggestion: an option to deliver the transcript directly in the StartTranscriptionJob response for short media would remove the polling loop for the common small-file case.

## Entry 3: React Native TV native builds hit Windows MAX_PATH under a real-world project path (2026-09-14)

- Task: first Gradle build of the React Native TV app (react-native-tvos template).
- Steps: gradlew assembleDebug from the repo path C:\Hackathons\Build, Ship, Shape Amazon Developer Hackathon\everyword\tv.
- Expected: the template builds from wherever the developer cloned it.
- Actual: the CMake/ninja step fails with "Filename longer than 260 characters" because codegen object paths embed the full mangled project path. Any hackathon participant whose folder is named after the hackathon will hit this.
- Severity: high (hard build failure, cryptic to newcomers).
- Workaround: map the repo to a short drive with subst (X:) and build from there; also trimmed reactNativeArchitectures to x86_64 for emulator iteration.
- Suggestion: the React Native Gradle plugin could detect Windows path-length risk at configure time and suggest subst or a shorter build staging dir; Amazon's Fire TV onboarding docs for Windows could carry a one-line warning.

## Entry 4: Metro and subst drives disagree about file identity (2026-09-14)

- Task: let Gradle's createBundleReleaseJsAndAssets bundle JS while building from the subst drive.
- Steps: gradlew assembleRelease from X: (the subst mapping added for entry 3).
- Expected: bundling works the same as from the original path.
- Actual: Metro fails with "Failed to get the SHA-1 for" a file it resolved via realpath back to C:, outside its X:-rooted file map. The two spellings of the same directory never reconcile.
- Severity: medium.
- Workaround: bundle manually from the real C: path (npx react-native bundle, which handles long paths fine) and, for dev, run Metro from C: while Gradle builds native code from X:.
- Suggestion: Metro could realpath its roots and requests consistently so a subst or junction alias of the project just works; this is the standard Windows workaround for entry 3, so the two failures compound.

## Entry 5: monorepo duplicate React needs the blocklist hammer (2026-09-14)

- Task: share the caption packages between the web app and the TV app in one repo.
- Steps: watchFolders plus extraNodeModules in metro.config; later a resolveRequest origin-redirect.
- Expected: extraNodeModules pins react to the app's copy.
- Actual: upward node_modules resolution from the shared packages found the repo root's React first and the app crashed with "Cannot read property 'useMemo' of null" (two Reacts). The resolveRequest origin trick did not take either; only resolver.blockList on the parent copies plus extraNodeModules fixed it deterministically.
- Severity: medium (well-known in the ecosystem, still a half-hour of a hackathon).
- Workaround: blockList the repo root's react, react-dom, and react-native, and pin extraNodeModules to the app's node_modules.
- Suggestion: a metro-config recipe for exactly this shape (app outside the workspaces, shared packages inside) in the React Native monorepo docs.

## Entry 6: streamed dataset audio must be decode-validated (2026-09-15)

- Task: fetch LibriSpeech utterances via the Hugging Face datasets-server rows API for the timing evaluation.
- Steps: sequential fetches of 45 audio files, saved as received, stitched with ffmpeg.
- Expected: HTTP 200 means a usable file.
- Actual: several bodies arrived truncated (flac decode failures mid-stream), silently shifting the stitched timeline and collapsing the first eval run to an 11.5 percent word match. Nothing errored until the numbers were nonsense.
- Severity: medium, because the failure mode poisons results rather than crashing.
- Workaround: decode-validate every download by transcoding it (ffmpeg to 16k mono wav), retry once on failure, drop and count the rest; the match rate went to 97.2 percent.
- Suggestion: datasets-server could send content-length or a checksum header for audio rows so clients can verify integrity without a decode pass.

## Entry 7: Polly's best-sounding engine cannot produce word speech marks (2026-09-15)

- Task: synthesize public-domain stories into read-alongs, using Polly word speech marks as the caption timing source.
- Steps: SynthesizeSpeech with OutputFormat json and SpeechMarkTypes ["word"], engine generative (Danielle), then neural.
- Expected: speech marks available across engines. Generative is the most natural-sounding option, and read-along narration for early readers is exactly where voice quality matters most.
- Actual: "ValidationException: The selected speech mark type - word - is not supported for this engine: generative". Neural and standard work. The restriction is not surfaced in describe-voices, which lists generative among a voice's SupportedEngines with no mention that speech marks are unavailable there, so the failure arrives only at synthesis time.
- Severity: medium. It forces a voice-quality tradeoff in the exact product category (reading tools, accessibility, karaoke captions) that most needs both the best voice and word timings.
- Workaround: pin neural voices (Joanna, Matthew, Ivy, Kendra) and fail fast with an explanatory message before spending a synthesis call.
- Suggestion: support word speech marks on the generative engine, or at minimum expose per-engine speech-mark support in describe-voices so a client can choose correctly before the request.

## Entry 8: Polly speech marks exclude attached punctuation (2026-09-15)

- Task: render the author's exact text in captions, quotation marks and all.
- Steps: build display words from each mark's value field.
- Expected: tokens usable directly as display text.
- Actual: marks cover the spoken token only, so a line of dialogue renders without its quotation marks. Dialogue-heavy children's stories lose every quote, which matters when part of the point is teaching people to read punctuation.
- Severity: low, once understood.
- Workaround: ignore the value field and slice the source text using the byte offsets the marks carry, extending left through opening punctuation and right through closing punctuation without re-consuming a previous word's characters.
- Suggestion: document the offsets-are-the-source-of-truth pattern in the speech marks guide; it is the difference between a normalized token stream and the author's text.

## Entry 9: Builder Tools init-context cannot run non-interactively (2026-09-15)

- Task: install the Amazon Devices Builder Tools, the hackathon's first "Start here" resource, into an agent-driven workflow.
- Steps: `init-context --agent claude-code-cli`, then again with the documented `--skip-mcp-config`, then with input piped to the prompt.
- Expected: the documented non-interactive flags (`--agent`, `--skip-mcp-config`, `--skip-context-document`, `--context-document-path`) make a scripted install possible.
- Actual: it prompts regardless ("Update Claude Code MCP Config Path: C:\Users\...\.claude.json? (y/n)"), and when stdin is not a TTY it crashes: `Error [ERR_USE_AFTER_CLOSE]: readline was closed`, with a stack trace and "contact support". `--skip-mcp-config` does not skip the prompt. That rules out CI, scripted onboarding, containers, and headless agent environments, which is a large share of the audience for a tool whose whole purpose is automation.
- Severity: high for automated setups; the crash also looks like a product failure rather than a missing TTY.
- Workaround: none for automation. We evaluated the MCP server by speaking MCP to it over stdio directly.
- Suggestion: when stdin is not a TTY, take the documented flag values and safe defaults instead of prompting, and never surface `ERR_USE_AFTER_CLOSE` to a user. Add `--yes` for good measure.

## Entry 10: init-context offers only a global agent config change (2026-09-15)

- Task: try the Builder Tools MCP server on one project without altering machine-wide configuration.
- Steps: run init-context and read the prompt.
- Expected: a project-scoped option, since MCP clients support project-level server config.
- Actual: the only offered path is the user's global agent config file. A developer evaluating the tool on one hackathon project has to change the configuration of every project on the machine.
- Severity: medium (trust and blast radius, not correctness).
- Workaround: decline, and run the server directly.
- Suggestion: prompt for scope (project or global) and default to project. It would also make the tool safe to recommend inside sample repositories.

## Entry 11: MCP argument validation errors do not name the missing argument (2026-09-15)

- Task: call `search_documentation` and `list_documents` from an MCP client.
- Steps: call with `{ query }`, the obvious minimum.
- Expected: an error naming the missing required field, as the tool's own JSON schema declares `target_platform` required and describes its shape.
- Actual: `Invalid arguments provided for tool search_documentation`, with no indication of which argument, and no hint that `target_platform` is a nested object (`{ device_os: ["vega_os"] }`) rather than a string. We recovered by dumping the input schema from `tools/list`, which an agent can do but a human debugging by hand will not think to.
- Severity: low, but it is per-call friction on the two most used tools in the server.
- Workaround: read `inputSchema` from `tools/list` and construct arguments from it.
- Suggestion: echo the failing field path and expected type, the way `set_project_context` already does. That tool returns `PROJECT_CONTEXT_REQUIRED` with the exact call to make next, which is genuinely the best error message we saw in this hackathon; the validation errors should meet the same bar.

<!-- Add new entries above this line as they happen. -->
