"""The Fire TV beats on Amazon's hosted Fire TV, with the whole console in frame.

Called by drive_qc.py's `take` command once Appstore Quality Central's
Live Device Interaction tab shows EveryWord's library on a hosted Fire
TV (FOS 14 3P TV). The track rule asks for footage of the project
running on a Fire TV device or Amazon's simulator, so nothing is
cropped: every frame is the whole console page, under an address bar
showing its real developer.amazon.com address, with the device's name,
the on-screen remote and the stream inside it.

The remote is the keyboard: arrows are the D-pad, Enter is select. The
program cannot read the device's screen, so it never trusts where focus
is: before every press that matters it walks left to the end of the row
and then right by a known count.

Timing
------
Chrome's recording of this page runs well behind the clock (eleven
seconds on Earshot's take) and the lag is not knowable in advance. So
the take claps twice, a green square in the corner of the page, once
before the first beat and once after the last, finds both in the file,
and maps every mark through the line between them. That also absorbs
any drift. Each mark is taken one stream latency (LAG) after the press
that changed the screen, so a beat begins on the picture it describes.
"""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

from playwright.sync_api import Page

from beats import BEATS

HERE = Path(__file__).parent
OUT = HERE / "build"
FULL_W, FULL_H = 3840, 2160
FPS = 25
CONSOLE_URL = "developer.amazon.com/apps-and-games/console/app-quality-central?Tab=LiveDeviceInteraction"

# Key to picture on the hosted stream.
LAG = 1.2
# Sintel's dialogue runs densely from 18 s to 45 s; both film beats start
# just before it, so the words are lighting for the whole line.
FILM_MARK = 17.0
# Library row: Sintel, then the five fables. Player row: Play/Pause,
# Read that line again, Slow down, Back to stories.
CARD = {"sintel": 0, "crow": 1}
ROW_WIDTH = 6
# The console's on-screen remote, in CSS pixels of the 1600x900 window:
# its Back button. The app's own "Back to stories" button is not used,
# because on the hosted device the key-up of that press lands on the
# library that has just mounted and opens whichever card sits under it.
REMOTE_BACK = (1159, 658)

BAR_CSS_H = 56
URL_BAR_JS = """
(() => {
  if (document.getElementById('__bar')) return;
  var H = %d;
  var b = document.createElement('div');
  b.id = '__bar';
  b.style.cssText = ['position:fixed','top:0','left:0','right:0','height:'+H+'px',
    'z-index:2147483646','background:#f3f1ec','border-bottom:1px solid #d9d3c7',
    'display:flex','align-items:center','padding:0 18px','gap:10px',
    'font:14px/1 Inter,system-ui,sans-serif','color:#1c1a17'].join(';');
  var lock = document.createElement('span');
  lock.textContent = '\\u{1F512}';
  lock.style.cssText = 'font-size:14px;line-height:1;opacity:0.85';
  var url = document.createElement('span');
  url.textContent = '%s';
  url.style.cssText = ['background:#fff','border:1px solid #d9d3c7','border-radius:10px',
    'padding:8px 14px','flex:1','max-width:760px','white-space:nowrap','overflow:hidden','text-overflow:ellipsis'].join(';');
  b.appendChild(lock); b.appendChild(url);
  document.body.appendChild(b);
})();
""" % (BAR_CSS_H, CONSOLE_URL)

CLAP_CSS = 40
CLAP_JS = (
    "(() => {var k=document.createElement('div');k.id='__clap';"
    "k.style.cssText='position:fixed;left:0;top:0;width:%dpx;height:%dpx;"
    "z-index:2147483647;background:#00ff00';document.documentElement.appendChild(k);})()" % (CLAP_CSS, CLAP_CSS)
)


def hold(seconds: float) -> None:
    time.sleep(max(seconds, 0))


def hold_alive(page: Page, seconds: float) -> None:
    """Hold, pressing Up every few seconds. The console's stream stops
    updating when no key arrives for a while (Earshot's first take froze
    for seventy seconds of film). Up is a key every screen of this app
    ignores: nothing is focusable above the player's buttons or the
    library's cards."""
    end = time.monotonic() + seconds
    while time.monotonic() < end - 4.0:
        hold(4.0)
        page.keyboard.press("ArrowUp")
    hold(end - time.monotonic())


def seconds_for(key: str, narration: dict[str, float]) -> float:
    beat = next(b for b in BEATS if b.key == key)
    return max(beat.pause_before + narration.get(key, beat.speak_seconds), beat.min_hold)


class Remote:
    def __init__(self, page: Page):
        self.page = page

    def press(self, key: str, gap: float = 0.45) -> None:
        self.page.keyboard.press(key)
        hold(gap)

    def walk_to(self, index: int, step: float = 0.45) -> None:
        for _ in range(ROW_WIDTH):
            self.press("ArrowLeft", 0.3)
        for _ in range(index):
            self.press("ArrowRight", step)

    def select(self) -> None:
        self.press("Enter", 0.3)


def stream_box(page: Page) -> dict:
    """The largest 16:9 canvas or video in any frame: the device."""
    best = None
    for frame in page.frames:
        for tag in ("video", "canvas"):
            try:
                els = frame.locator(tag).all()
            except Exception:  # noqa: BLE001
                continue
            for el in els:
                box = el.bounding_box()
                if not box or box["width"] < 300 or box["height"] < 200:
                    continue
                if abs(box["width"] / box["height"] - 16 / 9) > 0.2:
                    continue
                if best is None or box["width"] * box["height"] > best["width"] * best["height"]:
                    best = box
    if best is None:
        raise SystemExit("no stream on the page: is a device connected and its screen showing?")
    return best


def render_bar(page: Page) -> Path:
    """The address bar, drawn by this browser at this scale, captured,
    then removed, so the console keeps Amazon's own layout and the bar
    is composited above it."""
    page.evaluate(URL_BAR_JS)
    hold(0.6)
    dest = OUT / "qc-bar.png"
    page.screenshot(path=str(dest), clip={"x": 0, "y": 0, "width": page.viewport_size["width"], "height": BAR_CSS_H}, scale="device")
    page.evaluate("(() => { var b = document.getElementById('__bar'); if (b) b.remove(); })()")
    hold(0.6)
    return dest


def clap(page: Page) -> float:
    page.evaluate(CLAP_JS)
    at = time.monotonic()
    hold(0.8)
    page.evaluate("(() => { var k = document.getElementById('__clap'); if (k) k.remove(); })()")
    return at


def find_claps(path: Path, scale: float) -> list[float]:
    """Every second at which the corner turns green."""
    side = int(CLAP_CSS * scale * 0.6)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"crop={side}:{side}:2:2,scale=1:1,fps={FPS}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    found: list[float] = []
    was = False
    for k in range(0, len(raw) - 2, 3):
        r, g, b = raw[k], raw[k + 1], raw[k + 2]
        now = g > 200 and r < 90 and b < 90
        if now and not was:
            found.append((k // 3) / FPS)
        was = now
    return found


def take(page: Page, ctx, narration: dict[str, float]) -> int:
    page.evaluate("window.scrollTo(0, 0)")
    bar = render_bar(page)
    box = stream_box(page)
    print(f"  stream at {box['x']:.0f},{box['y']:.0f} {box['width']:.0f}x{box['height']:.0f} (css px)", flush=True)
    # The console passes a click on the stream to the device as a tap,
    # so a click in the middle of the library opens whichever card is
    # there. The wordmark in the header is not a control.
    page.mouse.click(box["x"] + box["width"] * 0.08, box["y"] + box["height"] * 0.1)
    hold(0.5)
    remote = Remote(page)
    marks: list[dict] = []
    start = time.monotonic()

    def mark(key: str) -> None:
        at = time.monotonic() - start
        marks.append({"key": key, "at": round(at, 3)})
        print(f"  {at:6.1f}s  {key}", flush=True)

    def open_film() -> None:
        """Sintel from the library, held until just before the dialogue.
        The stream stops updating without key presses, so Up, which the
        player ignores, keeps it flowing."""
        remote.walk_to(CARD["sintel"])
        remote.select()
        hold_alive(page, FILM_MARK)

    def back_to_stories() -> None:
        """The remote's Back key, which the app handles as close the
        story and report the words played. Then the stream is clicked
        again so key presses reach the device."""
        page.mouse.click(*REMOTE_BACK)
        hold(0.6)
        page.mouse.click(box["x"] + box["width"] * 0.08, box["y"] + box["height"] * 0.1)
        hold(0.4)

    clap_a = clap(page) - start
    hold(1.0)

    # Beat: Sintel, its words lighting.
    open_film()
    hold(LAG)
    mark("tv-watch")
    hold_alive(page, seconds_for("tv-watch", narration))

    # Beat: the library on the remote, then a fable reads.
    back_to_stories()
    hold(LAG + 0.6)
    mark("tv-read")
    read_end = time.monotonic() + seconds_for("tv-read", narration)
    remote.walk_to(0)
    hold(0.6)
    remote.press("ArrowRight", 1.0)
    remote.select()
    hold_alive(page, read_end - time.monotonic())

    # Beat: back on the library, the counts on the cards.
    hold(2.0)
    back_to_stories()
    hold(LAG + 0.6)
    mark("tv-progress")
    progress_end = time.monotonic() + seconds_for("tv-progress", narration)
    remote.press("ArrowRight", 1.2)
    remote.press("ArrowLeft", 0.0)
    hold_alive(page, progress_end - time.monotonic())

    # Beat: the close, back on the film.
    open_film()
    hold(LAG)
    mark("tv-close")
    hold_alive(page, seconds_for("tv-close", narration) + 2.5)

    clap_b = clap(page) - start
    # Chrome's recording drops its last seconds when the context closes,
    # and runs behind the clock; this is what it drops.
    hold_alive(page, 16.0)
    total = time.monotonic() - start

    vw = page.viewport_size["width"]
    video = page.video
    ctx.close()
    src = Path(video.path())
    raw = OUT / "tv-raw-full.webm"
    src.replace(raw)

    # The capture is the CSS window at twice device scale, top-left in a
    # grey-padded 4K file; measure it rather than assume it.
    scale = 2.0
    claps = find_claps(raw, scale)
    if len(claps) < 2:
        raise SystemExit(f"found {len(claps)} claps in the recording; need the first and the last")
    file_a, file_b = claps[0], claps[-1]
    k = (file_b - file_a) / (clap_b - clap_a)
    if not 0.9 < k < 1.1:
        raise SystemExit(f"the recording runs at {k:.3f}x the clock between the claps, which is not credible")
    for m in marks:
        m["at"] = round(file_a + (m["at"] - clap_a) * k, 3)

    cw, ch = int(vw * scale), int(vw * scale * 9 / 16)
    bar_h = round(BAR_CSS_H * FULL_W / vw)
    page_h = FULL_H - bar_h
    page_w = round(cw * page_h / ch)
    page_w -= page_w % 2
    dest = OUT / "tv.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-i", str(bar), "-filter_complex",
         f"[0:v]crop={cw}:{ch}:0:0,scale={page_w}:{page_h}:flags=lanczos[p];[1:v]scale={FULL_W}:{bar_h}[b];"
         f"[p]pad={FULL_W}:{FULL_H}:(ow-iw)/2:{bar_h}:color=0xf3f1ec[pp];[pp][b]overlay=0:0[v]",
         "-map", "[v]", "-r", str(FPS), "-fps_mode", "cfr",
         "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-an", str(dest)],
        check=True,
    )
    length = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dest)],
                                  check=True, capture_output=True, text=True).stdout.strip())
    (OUT / "tv-timings.json").write_text(json.dumps({
        "video": round(length, 3), "width": FULL_W, "height": FULL_H,
        "device": "Appstore Quality Central hosted Fire TV (FOS 14 3P TV), release APK v0.3.2",
        "framing": "the whole console page under an address bar showing its URL",
        "alignment": "two claps, before the first beat and after the last",
        "claps": {"clock": [round(clap_a, 3), round(clap_b, 3)], "file": [file_a, file_b], "rate": round(k, 4)},
        "beats": marks}, indent=1), encoding="utf8")
    print(f"\nwrote tv.mp4 and tv-timings.json: {len(marks)} beats over {total:.1f}s; claps at {file_a:.2f}s and {file_b:.2f}s, rate {k:.4f}", flush=True)
    return 0
