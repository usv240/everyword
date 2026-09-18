"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The product, running, before anyone clicks anything.
 *
 * EveryWord is a kinetic thing: words light up as they are spoken. The
 * previous landing page described that in a paragraph and put the actual
 * mechanic below the fold behind a Play button, which meant a reviewer
 * with three minutes could plausibly leave without ever seeing what the
 * product does. Nielsen Norman's eye-tracking work puts 57 percent of
 * viewing time above the fold; spending that on prose about a visual
 * effect is the most expensive mistake this page could make.
 *
 * So the hero is the effect itself, looping, silent, and needing nothing
 * from the visitor. Silent matters: browsers block audio autoplay, and a
 * demo that depends on sound is a demo most people never see.
 *
 * The timings below are not invented for the animation. They are the real
 * word timings from `crow-and-pitcher.captions.json`, produced by the
 * EveryWord pipeline through Amazon Transcribe, the same file the player
 * further down the page loads. The hero is therefore a true sample of the
 * output rather than a mock-up of it.
 */

/** Real word timings, in seconds, from the shipped caption document. */
const LINES = [
  {
    text: "A thirsty Crow found a Pitcher with some",
    words: [
      { w: "A", s: 1.892, e: 2.005 },
      { w: "thirsty", s: 2.005, e: 2.392 },
      { w: "Crow", s: 2.392, e: 2.705 },
      { w: "found", s: 2.705, e: 3.017 },
      { w: "a", s: 3.017, e: 3.08 },
      { w: "Pitcher", s: 3.08, e: 3.48 },
      { w: "with", s: 3.48, e: 3.642 },
      { w: "some", s: 3.642, e: 3.892 },
    ],
  },
  {
    text: "water in it, but so little was there that,",
    words: [
      { w: "water", s: 3.892, e: 4.267 },
      { w: "in", s: 4.267, e: 4.405 },
      { w: "it,", s: 4.405, e: 4.717 },
      { w: "but", s: 4.717, e: 5.08 },
      { w: "so", s: 5.08, e: 5.267 },
      { w: "little", s: 5.267, e: 5.53 },
      { w: "was", s: 5.53, e: 5.767 },
      { w: "there", s: 5.767, e: 5.955 },
      { w: "that,", s: 5.955, e: 6.355 },
    ],
  },
  {
    text: "try as she might, she could not reach it",
    words: [
      { w: "try", s: 6.355, e: 6.767 },
      { w: "as", s: 6.767, e: 6.917 },
      { w: "she", s: 6.917, e: 7.03 },
      { w: "might,", s: 7.03, e: 7.517 },
      { w: "she", s: 7.517, e: 7.892 },
      { w: "could", s: 7.892, e: 8.017 },
      { w: "not", s: 8.017, e: 8.267 },
      { w: "reach", s: 8.267, e: 8.48 },
      { w: "it", s: 8.48, e: 8.592 },
    ],
  },
];

const START = LINES[0]!.words[0]!.s;
const END = LINES[LINES.length - 1]!.words.at(-1)!.e;
const HOLD_AFTER_END = 1.1;

export function HeroDemo() {
  const [t, setT] = useState(START);
  const [reduced, setReduced] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Anyone who has asked their system to reduce motion gets the finished
    // state instead of a loop: the words are still shown lit, so the idea
    // survives without anything moving. Honouring this is not decoration,
    // it is the difference between a demo and a problem for some people.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) {
      setT(END);
      return;
    }
    let started: number | null = null;
    const tick = (now: number) => {
      if (started === null) started = now;
      const elapsed = (now - started) / 1000;
      const span = END - START + HOLD_AFTER_END;
      setT(START + (elapsed % span));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [reduced]);

  return (
    <div
      className="ew-hero-demo"
      role="img"
      aria-label={
        "A demonstration of word-by-word caption highlighting. The line reads: " +
        LINES.map((l) => l.text).join(" ") +
        ". Each word lights up at the moment it is spoken."
      }
    >
      {LINES.map((line, li) => (
        <p key={li} className="ew-hero-line">
          {line.words.map((word, wi) => {
            const state = reduced
              ? "done"
              : t >= word.s && t < word.e
                ? "active"
                : t >= word.e
                  ? "done"
                  : "upcoming";
            return (
              <span key={wi}>
                <span className="ew-hero-word" data-state={state}>
                  {word.w}
                </span>
                {wi < line.words.length - 1 ? " " : null}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
