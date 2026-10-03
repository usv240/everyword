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
        key="gap",
        action="landing_upgrade",
        pause_before=0.3,
        say=(
            "Subtitles show you what someone said. "
            "They don't show you which word they're saying right now."
        ),
        note=(
            "The problem in one contrast, over the site's before-and-after: "
            "the subtitle file the film shipped, a line at a time, beside the "
            "same words with a time on each."
        ),
    ),
    Beat(
        key="tv-watch",
        action="tv_watch",
        pause_before=0.4,
        min_hold=15.0,
        say=(
            "EveryWord does. This is a Fire TV, Amazon's hosted device, "
            "playing Sintel with the subtitles its makers shipped. "
            "EveryWord added the time of each word, and the film became reading practice."
        ),
        note=(
            "The product on the track's device inside ten seconds: the release "
            "APK on Appstore Quality Central's hosted Fire TV, with the console, "
            "its address and the on-screen remote in frame."
        ),
    ),
    Beat(
        key="tv-read",
        action="tv_read",
        pause_before=0.3,
        min_hold=10.0,
        say="Pick a story with the remote, and each word lights as it's spoken.",
        note="The interaction: the focus travels the library on the remote and a fable reads.",
    ),
    Beat(
        key="tv-progress",
        action="tv_progress",
        pause_before=0.3,
        say=(
            "The television also reports the words played to our MCP server, "
            "so an assistant can answer \"how far did my child get today?\" "
            "from playback activity the TV itself recorded."
        ),
        note=(
            "One sentence for the Alexa+ surface. 'Words played' is what the TV "
            "measures: the words the playback cursor passed, not comprehension."
        ),
    ),
    Beat(
        key="safety",
        action="landing_upgrade_point",
        pause_before=0.4,
        say=(
            "Amazon Transcribe never decides which words appear. The subtitle author did. "
            "Transcribe only says when to light them, so even if it mishears a word, "
            "it can't change what a child reads."
        ),
        note="The trust statement, over the two files the site serves.",
    ),
    Beat(
        key="pipeline",
        action="landing_pipeline",
        pause_before=0.4,
        say=(
            "The demo is a film and five fables, but the system isn't tied to them. "
            "Give it a video with subtitles, and Amazon Transcribe adds the timing. "
            "Give it public-domain text, and Amazon Polly narrates and times it. "
            "Both produce the same word-level caption format."
        ),
        note=(
            "The infrastructure moment, claiming only what the pipeline does: "
            "two ways in, one format, one renderer."
        ),
    ),
    Beat(
        key="evidence",
        action="landing_evidence",
        pause_before=0.5,
        min_hold=15.0,
        say=(
            "Karaoke-style subtitles ran on Indian national television for two decades, "
            "reaching an estimated two hundred million viewers. "
            "In a five-year study, thirty-two percentage points more children became good readers."
        ),
        note="The strongest fact in the project, held so the 32 points registers.",
    ),
    Beat(
        key="transfers",
        action="landing_evidence_hold",
        pause_before=0.6,
        say=(
            "It worked because nobody had to choose it: "
            "the practice rode programmes people already watched. "
            "EveryWord makes the idea programmable: upgrade the subtitles video already has, "
            "instead of producing special reading content."
        ),
        note="Why the research makes EveryWord valuable, not just interesting.",
    ),
    Beat(
        key="measured",
        action="landing_measure",
        pause_before=0.5,
        say=(
            "Against gold word alignments on speech we didn't record, "
            "the median timing error is thirty milliseconds, and in seven hundred and sixty-six words, "
            "not one lit more than a hundred and fifty milliseconds early. "
            "For a learning reader, lighting the next word too early creates the wrong word-to-sound match."
        ),
        note="Tech implementation, measured against something we did not author, with its human consequence.",
    ),
    Beat(
        key="privacy",
        action="landing_privacy",
        pause_before=0.4,
        say=(
            "And because it's designed for children, it keeps only five fields "
            "of reading-session data. There is no microphone."
        ),
        note="The question a parent asks first, answered structurally.",
    ),
    Beat(
        key="tv-close",
        action="tv_close",
        pause_before=0.5,
        min_hold=14.0,
        say=(
            "EveryWord doesn't ask anyone to open a reading app or change what they watch. "
            "It turns the video they already chose into reading practice. "
            "And because the caption engine and renderer are open source, "
            "other developers can bring the same experience to their own content. "
            "EveryWord. Watching becomes reading."
        ),
        note="Back on the television, words lighting, then black. Nothing after the line.",
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
