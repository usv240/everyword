/**
 * What every term and number on this page means, for someone who has never
 * heard of any of it.
 *
 * Three layers, always in this order, following the progressive-disclosure
 * pattern: the plain-language answer first, because that is what most
 * people want and it should cost them nothing to get; the technical detail
 * second, for a reviewer who wants to know how it was computed; the source
 * last, so any claim can be checked against something we did not write.
 *
 * Nielsen's caution about progressive disclosure applies: hiding something
 * people frequently need does not reduce complexity, it relocates it. So
 * nothing load-bearing lives only in here. Every headline claim is legible
 * on the page without opening anything, and these explain rather than
 * withhold.
 */

export interface InfoEntry {
  term: string;
  plain: string;
  technical?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

const ENTRIES: Record<string, InfoEntry> = {
  sls: {
    term: "Same Language Subtitling",
    plain:
      "Captions in the same language as the audio, highlighted word by word, on ordinary entertainment people already watch. Someone following along gets reading practice without signing up for anything or knowing they are practising.",
    technical:
      "It works because the reader gets the sound and the written form of the same word at the same instant, repeatedly, over years of ordinary viewing. It has run on Indian national television for two decades and has been national broadcast policy there since 2019.",
    sourceUrl:
      "https://www.uil.unesco.org/en/litbase/reading-billion-same-language-subtitling-india",
    sourceLabel: "UNESCO Institute for Lifelong Learning",
  },
  onset: {
    term: "30 ms median onset error",
    plain:
      "How close the highlight lands to the moment a word is actually spoken. Thirty milliseconds is about one frame of video: too small a gap for anyone to see the highlight and hear the word as two separate events.",
    technical:
      "Measured against gold Montreal Forced Aligner word alignments on LibriSpeech, a public speech corpus we did not record. The median absolute difference between the caption word start that drives the highlight and the gold word start is 30 ms; the 90th percentile is 85 ms. The same figures hold on test-other, the split the corpus labels difficult.",
    sourceUrl: "https://github.com/usv240/everyword/blob/main/docs/EVAL.md",
    sourceLabel: "Method, limits and reproduction command",
  },
  "never-early": {
    term: "Never early",
    plain:
      "A word may light up a little late. It must never light up before it is spoken. A highlight that runs ahead teaches a new reader that a sound belongs to the next word, which is worse than having no highlight at all.",
    technical:
      "Reported as an exact count rather than an average, because an average would hide it: zero words of 766 lit more than 150 ms early on the clean split, and zero of 761 on the hard one. A test in the repository fails if that number ever stops being zero.",
    sourceUrl: "https://github.com/usv240/everyword/blob/main/docs/EVAL.md",
    sourceLabel: "The negative control in full",
  },
  "line-breaks": {
    term: "Breaking lines at real pauses",
    plain:
      "Where a caption line ends. Ending it where the speaker actually pauses keeps a phrase together; ending it wherever the line runs out of room splits phrases in half and makes following harder.",
    technical:
      "A break counts as landing on a real pause when the gold timing shows a gap of at least 300 ms between the two words either side of it. EveryWord manages 42 percent against 2 percent for greedy fixed-width packing at the identical 42-character budget, so the difference is the clause-aware logic and not a wider line.",
    sourceUrl: "https://github.com/usv240/everyword/blob/main/docs/EVAL.md",
    sourceLabel: "The segmentation comparison",
  },
  polly: {
    term: "Polly speech marks",
    plain:
      "For stories nobody has recorded, Amazon Polly reads the text aloud and reports exactly when it said each word. Because the words were known before they were spoken, these captions cannot have the wrong word in them.",
    technical:
      "Zero word error by construction rather than by measurement: the synthesiser is told the text, so the caption is the input rather than a transcription of the output. This is how any public-domain book becomes a read-along without anyone recording it.",
  },
  transcribe: {
    term: "Timed with Amazon Transcribe",
    plain:
      "For stories a person actually read aloud, Amazon Transcribe listens to the recording and reports when each word was spoken. That is where the 30 ms figure comes from.",
    technical:
      "Word-level timestamps come back with every Transcribe result at no extra configuration. EveryWord normalises them into caption lines with a 42-character budget, clause-aware breaks and gap tiling so the highlight never flickers between two words of one phrase.",
  },
  "words-read": {
    term: "Words read along",
    plain:
      "How many words have lit up while you were watching. It is the only number here that measures reading rather than viewing, and it is the reason this is practice rather than television.",
    technical:
      "Counted from the renderer's own cursor as the highlight advances, so it reflects words actually displayed rather than minutes of playback. Seeking backwards never counts a word twice.",
  },
  "slow-mode": {
    term: "Slow mode",
    plain:
      "Plays the story more slowly without making the voice sound deep or strange, for a reader who needs longer with each word.",
    technical:
      "Playback rate is reduced with pitch preservation, and the captions follow automatically because they are driven by playback time rather than by a fixed schedule.",
  },
  "read-again": {
    term: "Read that line again",
    plain:
      "Jumps back to the start of the line you are on and plays it once more. Re-reading a line is the single most common thing a struggling reader wants to do, so it is one button rather than a scrub bar.",
  },
  attribution: {
    term: "Where this story comes from",
    plain:
      "Every story here is public domain, and every recording is credited. Nothing in this reader is used without a licence that permits it.",
    sourceUrl:
      "https://github.com/usv240/everyword/blob/main/CONTENT_LICENSES.md",
    sourceLabel: "Content licences, item by item",
  },
};

export function info(id: string): InfoEntry {
  const entry = ENTRIES[id];
  if (!entry) {
    // A missing entry is a content bug, and a silent one would ship an
    // empty popover. Fail loudly in development and degrade honestly in
    // production rather than showing a blank explainer.
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`No info entry for "${id}"`);
    }
    return { term: id, plain: "No explanation is available for this yet." };
  }
  return entry;
}

export const INFO_IDS = Object.keys(ENTRIES);
