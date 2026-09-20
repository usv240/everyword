"""Capture the Fire TV beats from the device itself.

    python record_tv.py

The Fire TV track rule is specific: the demo video has to show the
project *running* on a Fire TV device or simulator. So this footage is
not a screen recording of a browser pretending to be a television, and it
is not a mockup. It is the release APK, installed on a television-shaped
Android device, driven only by D-pad and media keys, captured by the
device's own screen, captured in real time from the host.

Why a separate program from record.py
-------------------------------------
Nothing about this camera is like the browser one. There is no DOM to
query, no way to assert what is on screen before spending a take, and the
only input channel is a remote control. The two recorders share `beats.py`
and nothing else, which is the honest amount of sharing.

Why the host records, and not the device
----------------------------------------
`adb shell screenrecord` is the obvious tool and it is the wrong one for
this video. It encodes a frame when the screen *changes*, so a static
shot produces almost nothing: fifteen seconds resting on the library
screen came back as a single frame, and a thirty-seven second take came
back as a twenty-six second file with the holds squeezed out of it. That
is time compression, which would make the television look faster than it
is, and this pipeline never speeds anything up.

So the host captures the emulator window with ffmpeg's gdigrab at a
constant thirty frames a second, which is real time by construction. The
emulator must therefore run with `-gpu swiftshader_indirect`: with
hardware rendering the window is a GPU surface and a window grab comes
back grey.

What it does, in order
----------------------
Boots the virtual device if it is not already up, installs the APK that
`tv/android` just built, launches it through the leanback launcher the way
a Fire TV home screen would, then records one continuous take while
driving the remote on a clock derived from the real narration lengths.

One take, not three
-------------------
The three television beats are cut from a single unbroken recording. A
viewer should see one device being used, not three clips that might each
be a different device or a different build. It also means the progress
number in the third beat is demonstrably the reading from the second,
because there was no cut in between.

Output
------
`build/tv.mp4` plus `build/tv-timings.json`, which says where each beat
begins inside that file. `assemble.py` reads the second to cut the first.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from beats import BEATS

HERE = Path(__file__).parent
OUT = HERE / "build"
REPO = HERE.parent
APK = REPO / "tv/android/app/build/outputs/apk/release/app-release.apk"

SDK = Path(os.environ.get("LOCALAPPDATA", "")) / "Android/Sdk"
ADB = SDK / "platform-tools/adb.exe"
EMULATOR = SDK / "emulator/emulator.exe"
AVD = "everyword-tv"

PACKAGE = "com.everywordtv"
WINDOW_TITLE = f"Android Emulator - {AVD}:5554"
FPS = 30
# Seconds of capture before the beat clock starts. Every beat mark is
# relative to the clock, so this is the offset into the file.
PREROLL = 2.0

# The device records at its own resolution, which is what the AVD is
# configured for and what a 1080p Fire TV outputs. Nothing is upscaled
# anywhere in this pipeline: the browser is captured at 1920x1080 too, so
# the two cameras meet at the same size and neither is interpolated.
WIDTH, HEIGHT = 1920, 1080


def adb(*args: str, check: bool = True, timeout: int = 120) -> str:
    proc = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=timeout)
    if check and proc.returncode != 0:
        raise SystemExit(f"adb {' '.join(args)} failed:\n{proc.stderr[-600:]}")
    return proc.stdout.strip()


def key(name: str) -> None:
    adb("shell", "input", "keyevent", name)


def booted() -> bool:
    try:
        return adb("shell", "getprop", "sys.boot_completed", check=False, timeout=20) == "1"
    except Exception:
        return False


def ensure_device() -> None:
    if booted():
        print("  device already up")
        return
    if not EMULATOR.exists():
        raise SystemExit(f"no emulator at {EMULATOR}; is the Android SDK installed?")
    print(f"  booting {AVD} ...")
    subprocess.Popen(
        [str(EMULATOR), "-avd", AVD, "-no-snapshot-load", "-no-boot-anim",
         # Software rendering, so the window is an ordinary bitmap that
         # gdigrab can read. With the default GPU path the capture is a
         # uniform grey rectangle and every other check still passes.
         "-gpu", "swiftshader_indirect"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(60):
        if booted():
            print("  booted")
            time.sleep(4)  # let the launcher settle before installing
            return
        time.sleep(5)
    raise SystemExit("the device never finished booting")


def install() -> None:
    if not APK.exists():
        raise SystemExit(
            f"no APK at {APK}.\n"
            "Build it first: npm run bundle in tv/, then gradlew assembleRelease."
        )
    age = time.time() - APK.stat().st_mtime
    print(f"  installing {APK.name} ({APK.stat().st_size / 1048576:.1f} MB, "
          f"built {age / 60:.0f} minutes ago)")
    adb("install", "-r", str(APK), timeout=300)


def hold(seconds: float) -> None:
    """Dead time, with the screen left alone.

    Deliberately not `time.sleep` everywhere else in this file: a hold is
    part of the shot and is named as such so the plan reads like a plan.
    """
    time.sleep(max(seconds, 0))


def seconds_for(key_name: str, narration: dict[str, float]) -> float:
    beat = next(b for b in BEATS if b.key == key_name)
    spoken = narration.get(key_name, beat.speak_seconds)
    return max(beat.pause_before + spoken, beat.min_hold)


def planned_seconds(narration: dict[str, float]) -> float:
    """How long the take will run, from the real narration lengths.

    Every hold below is derived from these, so the recording's own time
    limit is derived from them too rather than being a guessed number
    that could cut the last beat off.
    """
    tv = [b for b in BEATS if b.is_tv]
    # The holds, plus the fixed waits between them and the tail.
    return sum(seconds_for(b.key, narration) for b in tv) + 12.0


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = OUT / "narration.json"
    if not manifest.exists():
        raise SystemExit("no narration.json: run narrate.py first")
    narration = {n["key"]: n["seconds"] for n in json.loads(manifest.read_text(encoding="utf8"))}

    print("Fire TV capture")
    ensure_device()
    install()

    # Launch the way a Fire TV home screen does, through the leanback
    # category, rather than by activity name. If the manifest ever loses
    # LEANBACK_LAUNCHER this fails here instead of on a judge's device.
    adb("shell", "monkey", "-p", PACKAGE, "-c",
        "android.intent.category.LEANBACK_LAUNCHER", "1")
    time.sleep(7)

    dest = OUT / "tv.mp4"
    dest.unlink(missing_ok=True)
    rec = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error",
         "-f", "gdigrab", "-framerate", str(FPS), "-i", f"title={WINDOW_TITLE}",
         "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
         "-pix_fmt", "yuv420p", "-an", str(dest)],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    )
    print(f"  capturing the emulator window at {FPS}fps")
    time.sleep(PREROLL)  # let ffmpeg open the window and settle
    if rec.poll() is not None:
        raise SystemExit(
            "ffmpeg could not capture the emulator window. Is it running, "
            f'and is its title exactly "{WINDOW_TITLE}"?'
        )
    start = time.monotonic()
    marks: list[dict] = []

    def mark(key_name: str) -> None:
        at = time.monotonic() - start
        # Offsets are into the file, so they carry the pre-roll.
        marks.append({"key": key_name, "at": round(at + PREROLL, 3)})
        print(f"  {at:6.1f}s  {key_name}")

    # ---- Beat 1: the library, and that it is driven by a remote --------
    mark("tv-library")
    budget = seconds_for("tv-library", narration)
    # Move along the row and back, slowly, so a viewer sees the focus ring
    # travel rather than teleport. This is the only evidence in the video
    # that nothing here is a mouse.
    steps = ["DPAD_RIGHT", "DPAD_RIGHT", "DPAD_LEFT"]
    per = max((budget - 2.0) / (len(steps) + 1), 0.7)
    hold(1.2)
    for k in steps:
        key(k)
        hold(per)
    key("DPAD_RIGHT")
    hold(0.8)

    # ---- Beat 2: reading, on the television ----------------------------
    key("DPAD_CENTER")
    time.sleep(2.2)  # the story opens and starts playing
    mark("tv-read")
    hold(seconds_for("tv-read", narration))

    # ---- Beat 3: what the television told the server -------------------
    # Back to the library, which reports the session and shows the count
    # on the card. Navigating with the D-pad rather than pressing Back so
    # the button row is visible on the way past.
    for _ in range(3):
        key("DPAD_RIGHT")
        time.sleep(0.45)
    key("DPAD_CENTER")
    time.sleep(2.0)
    mark("tv-progress")
    # Walk back along the row to the story that was just read, so the
    # count is on the card as well as in the header. Returning to the
    # library puts focus on the first card, which left the story we had
    # actually read off the right edge of the frame with its badge cut
    # in half: the narration said "that number came off the TV" while
    # the number it referred to was not on screen.
    budget3 = seconds_for("tv-progress", narration)
    hold(1.0)
    for _ in range(2):
        key("DPAD_RIGHT")
        hold(0.9)
    hold(max(budget3 - 2.8, 0))
    hold(1.5)  # a tail, so the last cut is not on the final syllable

    total = time.monotonic() - start

    # 'q' on stdin is ffmpeg's clean stop: it flushes and writes the moov
    # atom. Killing it instead leaves a file that will not seek.
    try:
        rec.communicate(input=b"q", timeout=40)
    except subprocess.TimeoutExpired:
        rec.kill()
        raise SystemExit("ffmpeg would not stop; the take is unusable")

    if not dest.exists() or dest.stat().st_size < 100_000:
        raise SystemExit("the recording is missing or too small to be real")

    # The whole reason this recorder exists: real time, or it is a lie
    # about how fast the product is.
    captured = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(dest)],
        check=True, capture_output=True, text=True).stdout.strip())
    # The capture legitimately runs longer than the driven take: it starts
    # PREROLL seconds early and ffmpeg takes a moment to stop. What must
    # never happen is the capture coming back *shorter*, which is what
    # screenrecord did, and which silently speeds the footage up.
    expected = total + PREROLL
    print(f"  {total:.1f}s driven, {captured:.1f}s captured "
          f"(expected about {expected:.1f}s)")
    if captured < expected - 1.0:
        raise SystemExit(
            f"the capture is {expected - captured:.1f}s short of the take. "
            "Frames were dropped; do not ship time-compressed footage."
        )
    if captured > expected + 5.0:
        raise SystemExit(
            f"the capture ran {captured - expected:.1f}s long, so the beat "
            "marks will not line up with the picture."
        )

    (OUT / "tv-timings.json").write_text(
        json.dumps({"video": round(captured, 3), "width": WIDTH, "height": HEIGHT,
                    "beats": marks}, indent=1),
        encoding="utf8",
    )
    print(f"\nwrote {dest.name} ({dest.stat().st_size / 1048576:.1f} MB) "
          f"and tv-timings.json")
    print(f"{len(marks)} beats over {total:.1f}s of device footage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
