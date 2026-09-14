import { useEffect, useMemo, useRef } from "react";
import {
  computeWordIndex,
  type CaptionDoc,
  type WordIndex,
} from "@everyword/captions-core";

/**
 * karaoke-captions-react
 *
 * <KaraokeCaptions doc={doc} time={currentTime} /> renders the active
 * caption line with the spoken word highlighted, karaoke style. This is
 * Same Language Subtitling: the reading-practice technique validated on
 * hundreds of millions of viewers, packaged as a component.
 *
 * Styling contract (bring your own theme):
 * - the container gets class "kc" plus your className
 * - each word is a span.kc-word with data-state "done" | "active" | "upcoming"
 * - CSS custom properties the default styles honor:
 *   --kc-highlight (active word background), --kc-highlight-ink,
 *   --kc-done-ink, --kc-upcoming-ink
 * Set nothing and it inherits colors; set the variables and it sings.
 */

export interface KaraokeCaptionsProps {
  doc: CaptionDoc;
  /** Current playback time in seconds (poll or event-driven). */
  time: number;
  className?: string;
  /**
   * Called when the highlight advances, with how many words completed
   * since the last call. Drives reading-exposure meters. Seeking backward
   * never emits negative counts.
   */
  onWordsRead?: (count: number) => void;
}

/** Cumulative word position of a WordIndex within the whole document. */
export function globalWordPosition(doc: CaptionDoc, wi: WordIndex): number {
  if (wi.segment < 0) return 0;
  let n = 0;
  for (let i = 0; i < wi.segment && i < doc.segments.length; i++) {
    n += doc.segments[i]!.words.length;
  }
  return n + wi.word + 1;
}

export function useWordIndex(doc: CaptionDoc, time: number): WordIndex {
  return useMemo(() => computeWordIndex(doc, time), [doc, time]);
}

export function KaraokeCaptions({
  doc,
  time,
  className,
  onWordsRead,
}: KaraokeCaptionsProps) {
  const wi = useWordIndex(doc, time);
  const lastPosition = useRef(0);

  useEffect(() => {
    if (!onWordsRead) return;
    const position = globalWordPosition(doc, wi);
    if (position > lastPosition.current) {
      onWordsRead(position - lastPosition.current);
    }
    lastPosition.current = position;
  }, [doc, wi, onWordsRead]);

  const segment = wi.segment >= 0 ? doc.segments[wi.segment] : undefined;

  return (
    <div
      className={`kc ${className ?? ""}`.trim()}
      aria-live="off"
      style={{ lineHeight: 1.5 }}
    >
      {segment ? (
        segment.words.map((word, i) => {
          const state =
            i < wi.word ? "done" : i === wi.word ? "active" : "upcoming";
          return (
            <span key={`${segment.id}-${i}`}>
              <span
                className="kc-word"
                data-state={state}
                style={{
                  borderRadius: "0.3em",
                  padding: "0 0.12em",
                  transition: "background-color 120ms linear, color 120ms linear",
                  backgroundColor:
                    state === "active" ? "var(--kc-highlight, #ffd34d)" : "transparent",
                  color:
                    state === "active"
                      ? "var(--kc-highlight-ink, #21242b)"
                      : state === "done"
                        ? "var(--kc-done-ink, inherit)"
                        : "var(--kc-upcoming-ink, inherit)",
                  opacity: state === "upcoming" ? 0.55 : 1,
                }}
              >
                {word.w}
              </span>
              {i < segment.words.length - 1 ? " " : null}
            </span>
          );
        })
      ) : (
        <span className="kc-empty" aria-hidden>
          {" "}
        </span>
      )}
    </div>
  );
}
