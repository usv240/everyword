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

<!-- Add new entries above this line as they happen. -->
