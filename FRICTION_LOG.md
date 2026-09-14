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

<!-- Add new entries above this line as they happen. -->
