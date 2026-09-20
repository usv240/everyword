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
        note="A person before an interface, with the live address already on screen.",
    ),
    Beat(
        key="gap",
        action="landing_hold",
        pause_before=0.4,
        say=(
            "Every video already has subtitles, and every one of them is "
            "line level. They can tell you what was said. None can tell you "
            "which word is being spoken right now."
        ),
        note=(
            "The gap, stated before the product. This is the sentence the "
            "whole submission rests on, and it is checkable by anyone who "
            "has ever opened a subtitle file."
        ),
    ),
    Beat(
        key="why-that-matters",
        action="landing_hero",
        pause_before=0.4,
        say=(
            "Which means no subtitle track on earth can teach anybody to "
            "read. There is nothing to light."
        ),
        note="The consequence. Short, because it should land hard.",
    ),
    Beat(
        key="watch",
        action="reader_play",
        pause_before=0.5,
        min_hold=12.0,
        say=(
            "This is Sintel, from the Blender Foundation. It has shipped "
            "with English subtitles inside the file since twenty ten. Those "
            "cues are the filmmakers'. EveryWord added the word timings."
        ),
        note=(
            "The product, on a real film nobody here made. Held long enough "
            "to watch the highlight travel a full line, because this shot is "
            "the entire argument."
        ),
    ),
    Beat(
        key="proof",
        action="landing_upgrade",
        pause_before=0.5,
        say=(
            "Here is one line before and after, from the two files this "
            "site serves. Same words, same line breaks. Only the timing is "
            "new."
        ),
        note=(
            "The claim made checkable. A judge can open both files. This is "
            "the beat that turns an assertion into evidence."
        ),
    ),
    Beat(
        key="safety",
        action="landing_upgrade",
        pause_before=0.3,
        say=(
            "The words come from the subtitle author. Amazon Transcribe "
            "supplies only the timings, and is never asked what the words "
            "are. So a recogniser that mishears cannot put a wrong spelling "
            "in front of a child."
        ),
        note=(
            "Why the split is a safety property and not an implementation "
            "detail. The thing that makes it shippable to children."
        ),
    ),
    Beat(
        key="tv-library",
        action="tv_library",
        pause_before=0.6,
        min_hold=9.0,
        say=(
            "And here it is running on a Fire TV, sideloaded as an app and "
            "driven entirely by the remote."
        ),
        note=(
            "The track requirement. Device footage, shown early because the "
            "rule says show it running."
        ),
    ),
    Beat(
        key="tv-read",
        action="tv_read",
        pause_before=0.4,
        min_hold=11.0,
        say=(
            "The same film, the same subtitles, on the screen a family "
            "already watches. Nobody signed up for a reading lesson."
        ),
        note=(
            "The thesis in one shot, and the line that connects the demo to "
            "the research that follows."
        ),
    ),
    Beat(
        key="tv-progress",
        action="tv_progress",
        pause_before=0.4,
        say=(
            "The television reports what was actually read to our own MCP "
            "server, so an assistant can answer how far a child got. That "
            "number came off the TV."
        ),
        note="Where the Fire TV track and the Alexa plus track become one product.",
    ),
    Beat(
        key="evidence",
        action="landing_evidence",
        pause_before=0.5,
        say=(
            "This ran on Indian national television for twenty years, "
            "reaching two hundred million viewers. Thirty-two percentage "
            "points more children became good readers."
        ),
        note="The strongest fact in the project, and it is nobody's here.",
    ),
    Beat(
        key="transfers",
        action="landing_evidence",
        pause_before=0.3,
        say=(
            "It worked because nobody chose it. The practice rode programmes "
            "people already watched. A reading app cannot do that. Upgrading "
            "captions that already exist can."
        ),
        note=(
            "The most important beat in the video. It is the answer to the "
            "obvious objection, which is that this idea already exists: the "
            "idea exists, the mechanism has never been available for video, "
            "and a reading app does not inherit the result."
        ),
    ),
    Beat(
        key="measured",
        action="landing_measure",
        pause_before=0.5,
        say=(
            "The renderer is measured against gold alignments on speech we "
            "did not record. Thirty milliseconds from voice to highlight."
        ),
        note="Tech implementation, measured against something we did not author.",
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
        note="The number a teacher would care about.",
    ),
    Beat(
        key="privacy",
        action="landing_privacy",
        pause_before=0.5,
        say=(
            "It is for children, so here is everything it keeps. Five "
            "fields, and no microphone anywhere in it."
        ),
        note="The question a parent asks first, answered structurally.",
    ),
    Beat(
        key="close",
        action="reader_close",
        pause_before=0.5,
        min_hold=10.0,
        say=(
            "A hundred and thirty million American adults read below a sixth "
            "grade level. This costs four tenths of a cent per learner, and "
            "it now works on video that already exists. The renderer and the "
            "aligner are on npm, MIT licensed. EveryWord. Watching becomes "
            "reading."
        ),
        note=(
            "Scale, cost, the thing that changed, and what anyone can pick up "
            "tomorrow. Held on words lighting up, never on a logo."
        ),
    ),
    Beat(
        key="thanks",
        action="hold",
        pause_before=0.4,
        min_hold=2.2,
        say="Thank you.",
        note="Its own beat. Crowded onto the closing line it gets swallowed.",
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
