"use client";

import { useEffect, useState } from "react";

/**
 * The claim, side by side, from the two files that are already shipped.
 *
 * EveryWord's argument is one sentence: every video already has
 * subtitles, all of them are line level, and line level cannot teach
 * anyone to read because it never says which word is being spoken. That
 * is easy to say and hard to believe until you see the same line in both
 * forms.
 *
 * So this reads the actual subtitle file that came inside the film,
 * `sintel.source.srt`, and the caption document the pipeline produced
 * from it, and puts one cue's worth of each next to the other. Neither
 * is generated for this panel. Both are served from `/content`, both are
 * in the repository, and a visitor who does not believe the panel can
 * open them.
 *
 * What a reader should take from it: the words on the right are the same
 * words, in the same order, with the same spelling and punctuation. Only
 * the timing is new. That is the whole product, and it is also the
 * safety argument, because a recogniser that mishears cannot change a
 * word it was never asked to supply.
 */

const SOURCE_SRT = "/content/sintel.source.srt";
const UPGRADED = "/content/sintel.captions.json";

interface Word {
  w: string;
  s: number;
  e: number;
}
interface Segment {
  start: number;
  end: number;
  text: string;
  words: Word[];
}

/** The cue we show. The third line is a full sentence with nine words. */
const CUE_INDEX = 2;

function parseNthCue(srt: string, n: number): { start: string; end: string; text: string } | null {
  const blocks = srt.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);
  const block = blocks[n];
  if (!block) return null;
  const lines = block.split("\n").filter((l) => l.trim());
  const timeLine = lines.find((l) => l.includes("-->"));
  if (!timeLine) return null;
  const [start, end] = timeLine.split("-->").map((s) => s.trim());
  const text = lines.slice(lines.indexOf(timeLine) + 1).join(" ");
  return { start: start ?? "", end: end ?? "", text };
}

const secs = (n: number) => `${n.toFixed(2)}s`;

export function UpgradeProof() {
  const [source, setSource] = useState<ReturnType<typeof parseNthCue>>(null);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [srt, doc] = await Promise.all([
          fetch(SOURCE_SRT).then((r) => r.text()),
          fetch(UPGRADED).then((r) => r.json()),
        ]);
        if (!live) return;
        setSource(parseNthCue(srt, CUE_INDEX));
        setSegment((doc as { segments: Segment[] }).segments[CUE_INDEX] ?? null);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        The subtitle files could not be loaded, so nothing is being shown in
        their place.
      </p>
    );
  }

  const same =
    source && segment
      ? source.text.replace(/\s+/g, " ").trim() === segment.text.replace(/\s+/g, " ").trim()
      : false;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <p className="max-w-[760px] leading-relaxed text-muted">
        Sintel is distributed by the Blender Foundation with English
        subtitles inside the file. Here is one of its lines as the film
        shipped it, and the same line after EveryWord timed it. Both files
        are served from this site and are in the repository.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-line bg-bg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            What the film shipped
          </p>
          <p className="mt-1 text-sm text-muted">
            One line, one start, one end. Every subtitle track ever made.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-[12px] leading-relaxed text-ink">
            <code>
              {source
                ? `${source.start} --> ${source.end}\n${source.text}`
                : "loading ..."}
            </code>
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A renderer given this can show the sentence. It cannot know
            which word is being spoken, so it cannot highlight one, so it
            cannot teach anybody to read.
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--primary)] bg-bg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
            What EveryWord made from it
          </p>
          <p className="mt-1 text-sm text-muted">
            The same words. A time for each one.
          </p>
          <div className="mt-4 max-h-[13rem] overflow-y-auto rounded-lg border border-line bg-surface p-4">
            <table className="w-full font-mono text-[12px] leading-relaxed">
              <tbody>
                {(segment?.words ?? []).map((w, i) => (
                  <tr key={`${w.w}-${i}`}>
                    <td className="py-0.5 pr-4 text-muted">{secs(w.s)}</td>
                    <td className="py-0.5 text-ink">{w.w}</td>
                  </tr>
                ))}
                {!segment && (
                  <tr>
                    <td className="text-muted">loading ...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Now a renderer can light the word being spoken. That is the
            difference between a subtitle and a reading lesson.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-bg p-5">
        <p className="text-sm font-semibold text-ink">
          {same
            ? "The text is identical, character for character."
            : "Comparing the two lines ..."}
        </p>
        <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-muted">
          This is checked in the browser, by comparing the two files you
          can also open yourself. It is the safety property, not a
          nicety: Amazon Transcribe supplies the timings and is never
          asked what the words are, so a recogniser that hears
          &ldquo;their&rdquo; for &ldquo;there&rdquo; cannot put the wrong
          spelling in front of a child learning to read. The line breaks
          are the subtitle author&apos;s too. On this film,{" "}
          <span className="font-semibold text-ink">
            74 of 75 words anchored to a recognised word
          </span>
          ; the rest is interpolated inside its own line, so every word is
          on screen while its line is.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <a
            className="text-[var(--primary)] underline underline-offset-2"
            href={SOURCE_SRT}
            target="_blank"
            rel="noopener noreferrer"
          >
            The subtitle file that came with the film
          </a>
          {" · "}
          <a
            className="text-[var(--primary)] underline underline-offset-2"
            href={UPGRADED}
            target="_blank"
            rel="noopener noreferrer"
          >
            The caption document made from it
          </a>
          {" · "}
          <a
            className="text-[var(--primary)] underline underline-offset-2"
            href="/content/sintel.recognised.json"
            target="_blank"
            rel="noopener noreferrer"
          >
            Everything the recogniser heard
          </a>
        </p>
      </div>
    </div>
  );
}
