"""The demo video as data, not prose.

One record per beat: the pause before it, what the recorder should do, and
the exact line Polly will say. Nothing else in the pipeline may invent a
timecode; every downstream step derives its timing from here, and after
recording, from where each beat actually landed.

The script this was written from is docs/VIDEO_SCRIPT.md, which stays as
the human-readable argument for why the beats are in this order and what
each judging criterion is meant to land where. This file is what the
programs read.

Two cameras
-----------
Unlike the sibling projects, this video has two footage sources. Most
beats are the deployed website driven by a real browser. The Fire TV
beats are the release APK running on a television-shaped device, captured
from the device itself. `action` says which camera a beat belongs to:
anything starting with `tv_` is device footage, everything else is the
browser.

That split exists because the Fire TV track rule is specific. The video
has to show the project running on a Fire TV device or simulator, so that
footage is not optional and it is not left to the end.

The hard constraint
-------------------
The rules give a **three minute** ceiling and say judges are not required
to watch past it. `python beats.py` prints the estimate and exits
non-zero if the plan is already over, so the script is checked before a
single frame is recorded.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Polly long-form Patrick at 95 percent lands near this. Used only for the
# pre-flight estimate; real timings come from the recording.
WORDS_PER_MINUTE = 140
CEILING_SECONDS = 180


@dataclass
class Beat:
    key: str
    """Stable id. Used for the audio filename and the timing log."""

    say: str
    """Exactly what Polly speaks. Also the source of the subtitle cues."""

    action: str
    """Which function drives the screen. `tv_*` means device footage."""

    pause_before: float = 0.0
    """Dead seconds held before the line starts, for the shot to settle."""

    min_hold: float = 0.0
    """Floor on the shot's length, over and above the line plus pause."""

    note: str = ""
    """Why this beat exists. Read by a human, never by the pipeline."""

    @property
    def is_tv(self) -> bool:
        return self.action.startswith("tv_")

    @property
    def words(self) -> int:
        return len(self.say.split())

    @property
    def speak_seconds(self) -> float:
        return self.words * 60.0 / WORDS_PER_MINUTE

    @property
    def budget(self) -> float:
        return max(self.pause_before + self.speak_seconds, self.min_hold)


BEATS: list[Beat] = [
    Beat(
        key="hello",
        action="landing_hold",
        pause_before=0.0,
        say="Hi everyone, I am Ujwal.",
        note=(
            "A person before an interface, and no pause in front of it, so "
            "the video opens on a human rather than on a page. The live "
            "address is on screen from the first frame."
        ),
    ),
    Beat(
        key="idea",
        action="landing_hold",
        pause_before=0.4,
        say=(
            "Same language subtitling. Captions in the language you are "
            "already hearing, highlighted word by word, on ordinary "
            "entertainment."
        ),
        note="The idea named plainly, before any claim about it.",
    ),
    Beat(
        key="evidence",
        action="landing_evidence",
        pause_before=0.5,
        say=(
            "Twenty years on Indian national television, two hundred million "
            "viewers. Thirty-two percentage points more children became good "
            "readers."
        ),
        note=(
            "The strongest fact in the project, and it is nobody's here. "
            "Shown on the page with its citation rather than only spoken."
        ),
    ),
    Beat(
        key="gap",
        action="landing_hero",
        pause_before=0.5,
        say=(
            "Amazon already ships this for books, as Immersion Reading. No "
            "television platform has ever shipped it for video. EveryWord is "
            "that product."
        ),
        note=(
            "The gap, and the claim to fill it. Naming what Amazon already "
            "does is what makes the idea land as obvious rather than novel."
        ),
    ),
    Beat(
        key="play",
        action="reader_play",
        pause_before=0.5,
        min_hold=13.0,
        say=(
            "Real story, real captions from our pipeline. Every word lights "
            "as it is spoken, so watching becomes reading practice."
        ),
        note=(
            "The product explaining itself. Held long enough for a viewer to "
            "watch the highlight actually travel a line, because this shot is "
            "the entire design argument."
        ),
    ),
    Beat(
        key="meter",
        action="reader_meter",
        pause_before=0.4,
        say=(
            "And this counts the words the reader followed. Not minutes "
            "played. It is the only number here that measures reading."
        ),
        note=(
            "The one metric no other reading product has, pointed at while "
            "it is moving."
        ),
    ),
    Beat(
        key="again",
        action="reader_again",
        pause_before=0.4,
        say="One button to hear a line again.",
        note="A click on camera, so the controls are shown working.",
    ),
    Beat(
        key="tv-library",
        action="tv_library",
        pause_before=0.6,
        min_hold=9.0,
        say=(
            "And here it is running on a Fire TV, sideloaded as an app and "
            "driven entirely by the remote. Five stories, chosen with the "
            "D-pad."
        ),
        note=(
            "The track requirement. Device footage, not a mockup and not the "
            "browser pretending. First of three television beats because the "
            "rule says show it running, so it is shown early."
        ),
    ),
    Beat(
        key="tv-read",
        action="tv_read",
        pause_before=0.4,
        min_hold=11.0,
        say=(
            "Same renderer as the browser, rebuilt for ten feet away. A child "
            "watching television gets reading practice, and nobody signed them "
            "up."
        ),
        note=(
            "The highlight moving on a TV screen. The whole thesis in one "
            "shot: this is the living room, not a tablet."
        ),
    ),
    Beat(
        key="tv-progress",
        action="tv_progress",
        pause_before=0.4,
        say=(
            "The television reports what was read to our own server, so an "
            "assistant can answer how far a child got. That number came off "
            "the TV."
        ),
        note=(
            "Where the Fire TV track and the Alexa plus track become one "
            "product instead of two that share a package."
        ),
    ),
    Beat(
        key="pipeline",
        action="landing_sources",
        pause_before=0.5,
        say=(
            "Two ways in. A human recording timed by Amazon Transcribe, or "
            "any text read aloud by Amazon Polly, which reports when it said "
            "each word."
        ),
        note=(
            "How the library scales past what we hand-made. Pointed at the "
            "story cards, which are labelled with which path made them."
        ),
    ),
    Beat(
        key="polly",
        action="landing_sources",
        pause_before=0.3,
        say=(
            "Those captions cannot contain a wrong word, because the words "
            "were known before they were spoken. Any book can become a "
            "read-along."
        ),
        note=(
            "The consequence, which is the part that makes it a product "
            "rather than five fables."
        ),
    ),
    Beat(
        key="measured",
        action="landing_measure",
        pause_before=0.5,
        say=(
            "We measured our part against gold word alignments, on speech we "
            "did not record. The highlight lands within thirty milliseconds of "
            "the spoken word. About one frame."
        ),
        note=(
            "The tech implementation beat. Measured against something we did "
            "not author, which is the only kind of number worth saying."
        ),
    ),
    Beat(
        key="zero",
        action="landing_zero",
        pause_before=0.3,
        say=(
            "And it never lights a word early. Zero out of seven hundred and "
            "sixty-six. A highlight that runs ahead teaches a child the wrong "
            "word."
        ),
        note=(
            "The number a teacher would care about, and the reason it is "
            "pinned rather than tracked."
        ),
    ),
    Beat(
        key="privacy",
        action="landing_privacy",
        pause_before=0.5,
        say=(
            "It is for children, so here is everything it keeps. Five fields, "
            "and no microphone anywhere in it. A product that cannot listen "
            "cannot leak what it heard."
        ),
        note=(
            "The question a parent asks first. The structural answer is "
            "stronger than a promise and it is on the page to be read."
        ),
    ),
    Beat(
        key="close",
        action="reader_close",
        pause_before=0.5,
        min_hold=10.0,
        say=(
            "A hundred and thirty million American adults read below a sixth "
            "grade level. This technique costs four tenths of a cent per "
            "learner. The renderer nobody had shipped is on npm, MIT licensed. "
            "EveryWord. Watching becomes reading."
        ),
        note=(
            "Scale, cost, and the thing anyone can pick up tomorrow, held on "
            "the words lighting up rather than on a logo."
        ),
    ),
    Beat(
        key="thanks",
        action="hold",
        pause_before=0.4,
        min_hold=2.2,
        say="Thank you.",
        note=(
            "Its own beat. Crowded onto the closing line it gets swallowed. "
            "Nothing follows it."
        ),
    ),
]


# --------------------------------------------------------------------------
# Where inside a line each sentence falls.
#
# Two things need this and they must agree: the subtitler, which puts a cue
# on screen, and the recorder, which moves the cursor to whatever that cue
# is talking about. If they disagree the pointer describes one thing while
# the words describe another, which is worse than not pointing at all.
# --------------------------------------------------------------------------

def sentences(line: str) -> list[str]:
    # Not after "a.m." or "p.m.", and not after a single initial.
    parts = re.split(r"(?<=[.!?])(?<![ap]\.m\.)\s+", line.strip())
    return [p.strip() for p in parts if p.strip()]


def sentence_spans(line: str, seconds: float) -> list[tuple[float, float]]:
    """Start and end of each sentence, in seconds from the line's start.

    Share by character count. Speech is not uniform, but the error inside
    one sentence is tenths of a second, and every boundary is a real
    boundary, which is what a cursor move needs.
    """
    parts = sentences(line)
    total = sum(len(p) for p in parts) or 1
    spans: list[tuple[float, float]] = []
    clock = 0.0
    for part in parts:
        span = seconds * len(part) / total
        spans.append((clock, clock + span))
        clock += span
    return spans


def estimate() -> float:
    return sum(b.budget for b in BEATS)


def main() -> int:
    total = estimate()
    tv = sum(b.budget for b in BEATS if b.is_tv)
    print(f"{len(BEATS)} beats, {sum(b.words for b in BEATS)} spoken words")
    print(f"{sum(1 for b in BEATS if b.is_tv)} of them are Fire TV device footage\n")
    clock = 0.0
    for b in BEATS:
        cam = "TV " if b.is_tv else "web"
        print(
            f"  {int(clock // 60)}:{int(clock % 60):02d}  {cam}  {b.key:14} "
            f"{b.budget:5.1f}s  {b.action}"
        )
        clock += b.budget
    print(f"\nestimated runtime {int(total // 60)}:{int(total % 60):02d}")
    print(f"of which {tv:.0f}s is on the television")
    print(f"ceiling {CEILING_SECONDS // 60}:{CEILING_SECONDS % 60:02d}")
    if total > CEILING_SECONDS:
        print("\nOVER THE CEILING. Cut a beat before recording anything.")
        return 1
    print(f"\n{CEILING_SECONDS - total:.0f}s of headroom for the screen to keep up.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
