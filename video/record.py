"""Drive the deployed site in a real browser and record the web beats.

    python record.py

Records the live site at https://d34emfdcezeszz.cloudfront.net, not a
local build. A judge watching this video should be watching the same
thing they can open themselves, and a local dev server would let a
difference between the two go unnoticed.

Frame size
----------
1920x1080, which is also what `record_tv.py` captures. The two cameras
meet at the same size so neither is scaled when they are cut together.
Playwright records the CSS viewport, so the viewport *is* the frame:
asking for a larger `record_video_size` pads with grey rather than
upscaling, which is why those two numbers are the same constant here.

What is drawn over the page
---------------------------
Two things, both because Playwright records the page and not the browser.
An address bar, so the live URL is on screen from the first frame and the
video is visibly of a real site. And a cursor ring, because the real
pointer is not in the recording, so without it clicks happen by magic and
a viewer cannot tell navigation from a cut.

The cursor ring is appended to `documentElement`, never to `body`. A
sibling project spent three takes on this: CSS `zoom` on `body` scales
the coordinates of fixed-position descendants, so the ring rendered at
roughly twice the mouse position and walked off the bottom of the frame.
Nothing here zooms today, and the rule is kept anyway because the failure
is invisible until you read a still.

Timing
------
Each beat is held for as long as its narration actually runs, read from
`build/narration.json`, plus its own pause. Nothing is guessed, and
nothing is ever sped up afterwards: `assemble.py` only removes screen
that has already settled with nothing being said over it.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from beats import BEATS, sentence_spans, sentences

HERE = Path(__file__).parent
OUT = HERE / "build"
SITE = "https://d34emfdcezeszz.cloudfront.net"

# The frame. Must equal the viewport: Playwright records the viewport and
# pads anything larger with grey.
WIDTH, HEIGHT = 1920, 1080
SCALE = 1

# The page, enlarged for a video rather than for a desk.
#
# At 1:1 the site is correct and the body copy is about fourteen real
# pixels tall in a 1080p frame, which is legible on a monitor and a
# squint on a laptop playing YouTube. A judge should not have to squint.
# This trades some of the page's width for type a third larger.
#
# Not more than this: the two Fire TV beats are native 1920x1080 device
# footage and are not scaled at all, so the web beats should not drift so
# far in apparent size that the cuts between them jar.
PAGE_ZOOM = 1.35
URL_BAR_HEIGHT = 56 * SCALE

# Where a scrolled-to element should come to rest: below the address bar,
# and high enough that the burned-in captions do not cover it.
REST_Y = URL_BAR_HEIGHT + 150


NATIVE_SCROLL_OFF_JS = """
(() => {
  const style = document.createElement('style');
  style.textContent = 'html, body { scroll-behavior: auto !important; }';
  document.documentElement.appendChild(style);
})();
"""

ZOOM_JS = f"""
(() => {{ document.body.style.zoom = "{PAGE_ZOOM}"; }})();
"""

CURSOR_JS = ("""
(() => {
  if (window.__ewCursor) return;
  window.__ewCursor = true;
  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'pointer-events:none',
    'width:' + (26*__SCALE__) + 'px', 'height:' + (26*__SCALE__) + 'px',
    'margin:' + (-13*__SCALE__) + 'px 0 0 ' + (-13*__SCALE__) + 'px',
    'border:' + (2*__SCALE__) + 'px solid rgba(255,211,77,0.95)', 'border-radius:50%',
    'background:rgba(255,211,77,0.18)',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.30)',
    'transition:transform 90ms ease-out', 'left:-100px', 'top:-100px',
  ].join(';');
  document.documentElement.appendChild(ring);
  addEventListener('mousemove', (e) => {
    ring.style.left = e.clientX + 'px';
    ring.style.top = e.clientY + 'px';
  }, true);
  addEventListener('mousedown', () => {
    ring.style.transform = 'scale(1.75)';
    const pulse = document.createElement('div');
    pulse.style.cssText = ring.style.cssText
      .replace('left:-100px', 'left:' + ring.style.left)
      .replace('top:-100px', 'top:' + ring.style.top)
      + ';transition:transform 420ms ease-out,opacity 420ms ease-out';
    document.documentElement.appendChild(pulse);
    requestAnimationFrame(() => {
      pulse.style.transform = 'scale(2.6)';
      pulse.style.opacity = '0';
    });
    setTimeout(() => pulse.remove(), 460);
  }, true);
  addEventListener('mouseup', () => { ring.style.transform = 'scale(1)'; }, true);
})();
""".replace("__SCALE__", str(SCALE)))

URL_BAR_JS = (r"""
(() => {
  if (window.__ewUrlBar) return;
  window.__ewUrlBar = true;
  const H = 56 * __SCALE__;
  const style = document.createElement('style');
  style.textContent =
    'body { padding-top: ' + H + 'px !important; }' +
    'header { top: ' + H + 'px !important; }';
  document.documentElement.appendChild(style);

  const bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'height:' + H + 'px',
    'z-index:2147483646', 'pointer-events:none',
    'display:flex', 'align-items:center', 'padding:0 ' + (18 * __SCALE__) + 'px',
    'background:#1f2430', 'border-bottom:1px solid rgba(255,255,255,0.10)',
    'box-shadow:0 2px 10px rgba(0,0,0,0.20)',
  ].join(';');

  const omnibox = document.createElement('div');
  omnibox.style.cssText = [
    'display:flex', 'align-items:center', 'gap:' + (11 * __SCALE__) + 'px', 'flex:1',
    'height:' + (36 * __SCALE__) + 'px', 'padding:0 ' + (18 * __SCALE__) + 'px',
    'border-radius:999px',
    'background:#2b313f', 'border:1px solid rgba(255,255,255,0.10)',
    'font:500 ' + (19 * __SCALE__) + 'px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    'color:#f2f4f8', 'letter-spacing:0.2px',
  ].join(';');

  const lock = document.createElement('span');
  lock.textContent = '\u{1F512}';
  lock.style.cssText = 'font-size:' + (16 * __SCALE__) + 'px;line-height:1;opacity:0.9';

  const text = document.createElement('span');
  const paint = () => {
    const href = location.href.replace(/\/$/, '');
    if (text.textContent !== href) text.textContent = href;
  };
  paint();
  setInterval(paint, 250);

  omnibox.appendChild(lock);
  omnibox.appendChild(text);
  bar.appendChild(omnibox);
  document.documentElement.appendChild(bar);
})();
""".replace("__SCALE__", str(SCALE)))


def run(args: list[str]) -> None:
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"{args[0]} failed:\n{proc.stderr[-1200:]}")


class Recorder:
    """The browser, plus the clock every beat is timed against."""

    def __init__(self, page: Page, start: float, narration: dict[str, float]):
        self.page = page
        self.start = start
        self.narration = narration
        self.marks: list[dict] = []
        self.current: str | None = None

    # ---- timing ---------------------------------------------------------
    def mark(self, beat) -> None:
        at = time.monotonic() - self.start
        self.current = beat.key
        self.marks.append({"key": beat.key, "at": round(at, 3)})
        print(f"  {at:6.1f}s  {beat.key:14} {beat.action}")

    def spoken(self, key: str) -> float:
        beat = next(b for b in BEATS if b.key == key)
        return self.narration.get(key, beat.speak_seconds)

    def budget(self, key: str) -> float:
        beat = next(b for b in BEATS if b.key == key)
        return max(beat.pause_before + self.spoken(key), beat.min_hold)

    def hold_beat(self) -> None:
        """Hold the current shot for the rest of its narration."""
        assert self.current is not None
        began = next(m["at"] for m in self.marks if m["key"] == self.current)
        end = began + self.budget(self.current)
        remaining = end - (time.monotonic() - self.start)
        if remaining > 0:
            self.page.wait_for_timeout(remaining * 1000)

    def on_phrase(self, text: str) -> None:
        """Wait until the narration reaches a sentence containing `text`.

        Beat actions point the cursor at things. A pointer that arrives
        while the words are still describing something else is worse than
        no pointer, so moves are scheduled against the sentence that
        mentions them rather than against a guessed offset.
        """
        assert self.current is not None
        key = self.current
        line = next(b.say for b in BEATS if b.key == key)
        spans = sentence_spans(line, self.spoken(key))
        parts = sentences(line)
        idx = next((i for i, s in enumerate(parts) if text.lower() in s.lower()), None)
        if idx is None:
            raise SystemExit(
                f"beat {key!r} has no sentence containing {text!r}; "
                "the narration changed and this action did not"
            )
        began = next(m["at"] for m in self.marks if m["key"] == key)
        target = began + next(b.pause_before for b in BEATS if b.key == key) + spans[idx][0]
        remaining = target - (time.monotonic() - self.start)
        if remaining > 0:
            self.page.wait_for_timeout(remaining * 1000)

    # ---- camera ---------------------------------------------------------
    def scroll_to(self, selector: str, rest: int = REST_Y) -> None:
        """Ease the page so `selector` rests just under the address bar.

        Self-correcting rather than fire-and-forget: the site's own
        smooth-scroll fought an earlier version of this and every shot
        came to rest a couple of hundred pixels short, which is invisible
        in the log and obvious in a still.
        """
        page = self.page
        page.wait_for_selector(selector, timeout=30_000)
        for _ in range(6):
            box = page.locator(selector).first.bounding_box()
            if box is None:
                raise SystemExit(f"{selector!r} is not on the page")
            delta = box["y"] - rest
            if abs(delta) < 12:
                return
            page.mouse.wheel(0, delta)
            page.wait_for_timeout(240)

    def point(self, selector: str, dx: int = 0, dy: int = 0) -> None:
        box = self.page.locator(selector).first.bounding_box()
        if box is None:
            raise SystemExit(f"cannot point at {selector!r}: not on the page")
        self.page.mouse.move(
            box["x"] + box["width"] / 2 + dx,
            box["y"] + box["height"] / 2 + dy,
            steps=22,
        )
        self.page.wait_for_timeout(120)

    def click(self, selector: str) -> None:
        self.point(selector)
        self.page.mouse.down()
        self.page.wait_for_timeout(90)
        self.page.mouse.up()


# --------------------------------------------------------------------------
# Beat actions.
#
# Each yields once when the shot is composed. The driver marks the beat at
# that yield, so the narration starts against a settled screen rather than
# against a page still moving, and anything after the yield happens while
# the line is being spoken.
# --------------------------------------------------------------------------

HERO = "#ew-hero-heading"
PLAYER = "text=Words read along"
AGAIN = "button:has-text('Read that line again')"
PLAY = "button:has-text('Play')"
EVIDENCE = "text=200 million"
MEASURE = "text=30 ms"
MEASURED_BOX = "text=Measured, not promised"
EARLY_ZERO = "text=766 matched words"
PRIVACY = "#privacy"
CARDS = "text=CHOOSE A STORY"


def landing_hold(r: Recorder):
    yield
    r.hold_beat()


def landing_evidence(r: Recorder):
    r.scroll_to(EVIDENCE)
    yield
    r.on_phrase("Thirty-two")
    r.point(EVIDENCE)
    r.hold_beat()


def landing_hero(r: Recorder):
    r.scroll_to(HERO, rest=URL_BAR_HEIGHT + 90)
    yield
    r.hold_beat()


def reader_play(r: Recorder):
    r.scroll_to(CARDS, rest=URL_BAR_HEIGHT + 40)
    r.click(PLAY)
    r.page.wait_for_timeout(700)
    yield
    r.hold_beat()


def reader_meter(r: Recorder):
    yield
    r.on_phrase("And this counts")
    r.point(PLAYER)
    r.hold_beat()


def reader_again(r: Recorder):
    yield
    r.click(AGAIN)
    r.hold_beat()


def landing_sources(r: Recorder):
    r.scroll_to(CARDS, rest=URL_BAR_HEIGHT + 40)
    yield
    r.hold_beat()


def landing_measure(r: Recorder):
    # Rest the claim itself near the top of the frame rather than the
    # element containing the number. An earlier take scrolled to "30 ms"
    # and left the measurement box as a small grey rectangle in the top
    # third while story cards filled the shot, so the narration talked
    # about accuracy over a picture of a library.
    r.scroll_to(MEASURED_BOX, rest=URL_BAR_HEIGHT + 90)
    yield
    r.on_phrase("thirty milliseconds")
    r.point(MEASURE)
    r.hold_beat()


def landing_zero(r: Recorder):
    yield
    r.on_phrase("Zero out of")
    r.point(EARLY_ZERO)
    r.hold_beat()


def landing_privacy(r: Recorder):
    r.scroll_to(PRIVACY, rest=URL_BAR_HEIGHT + 60)
    yield
    r.hold_beat()


def reader_close(r: Recorder):
    r.scroll_to(CARDS, rest=URL_BAR_HEIGHT + 40)
    # Play again so the closing lines run over words actually lighting up
    # rather than over a still page.
    try:
        r.click(PLAY)
    except SystemExit:
        pass
    r.page.wait_for_timeout(600)
    yield
    r.hold_beat()


def hold(r: Recorder):
    yield
    r.hold_beat()


ACTIONS = {
    "landing_hold": landing_hold,
    "landing_evidence": landing_evidence,
    "landing_hero": landing_hero,
    "reader_play": reader_play,
    "reader_meter": reader_meter,
    "reader_again": reader_again,
    "landing_sources": landing_sources,
    "landing_measure": landing_measure,
    "landing_zero": landing_zero,
    "landing_privacy": landing_privacy,
    "reader_close": reader_close,
    "hold": hold,
}


def assert_full_frame(path: Path) -> None:
    """Refuse a recording that is padded rather than filled.

    Playwright pads a `record_video_size` larger than the viewport with
    grey instead of upscaling, and the result looks like a correct
    recording in every log line.
    """
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True).stdout.strip()
    w, h = (int(x) for x in out.split(",")[:2])
    if (w, h) != (WIDTH, HEIGHT):
        raise SystemExit(
            f"recorded {w}x{h} but the frame is {WIDTH}x{HEIGHT}; "
            "the viewport and the capture size must match"
        )


def main() -> int:
    manifest = OUT / "narration.json"
    if not manifest.exists():
        raise SystemExit("no narration.json: run narrate.py first")
    narration = {n["key"]: n["seconds"]
                 for n in json.loads(manifest.read_text(encoding="utf8"))}

    web = [b for b in BEATS if not b.is_tv]
    video_dir = OUT / "raw"
    for stale in video_dir.glob("*.webm"):
        stale.unlink()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--force-color-profile=srgb",
                                           "--autoplay-policy=no-user-gesture-required"])
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1,
            color_scheme="dark",
            record_video_dir=str(video_dir),
            record_video_size={"width": WIDTH, "height": HEIGHT},
        )
        page = context.new_page()
        page.add_init_script(
            "document.addEventListener('DOMContentLoaded', () => {"
            + ZOOM_JS + NATIVE_SCROLL_OFF_JS + CURSOR_JS + URL_BAR_JS + "});"
        )
        print(f"{WIDTH}x{HEIGHT} against {SITE}")
        page.goto(SITE, wait_until="networkidle", timeout=90_000)
        page.wait_for_selector(HERO, timeout=60_000)
        page.wait_for_timeout(1200)
        page.mouse.move(WIDTH * 0.5, HEIGHT * 0.55)

        r = Recorder(page, time.monotonic(), narration)
        for beat in web:
            steps = ACTIONS[beat.action](r)
            next(steps, None)
            r.mark(beat)
            for _ in steps:
                pass

        total = time.monotonic() - r.start
        video = page.video
        # The path has to be read while Playwright is still running, and
        # only after the context is closed, which is when the file is
        # finalised. Reading it after the `with` block raises "Event loop
        # is closed" and throws away a take that was otherwise perfect.
        context.close()
        src = Path(video.path())
        browser.close()

    dest = OUT / "web.mp4"
    run(["ffmpeg", "-y", "-i", str(src), "-c:v", "libx264", "-crf", "18",
         "-preset", "medium", "-tune", "stillimage", "-pix_fmt", "yuv420p",
         "-an", str(dest)])
    assert_full_frame(dest)

    (OUT / "web-timings.json").write_text(
        json.dumps({"video": round(total, 3), "width": WIDTH, "height": HEIGHT,
                    "beats": r.marks}, indent=1),
        encoding="utf8")
    print(f"\nwrote {dest.name} and web-timings.json")
    print(f"{len(r.marks)} web beats over {total:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
