# The demo video

Two cameras, one timeline, three minutes, 3840x2160.

```
python beats.py          # check the script fits the ceiling first
python narrate.py        # Polly, one clip per beat
python record.py         # the web beats, from a real browser
python drive_qc.py       # the Fire TV beats, on an Amazon-hosted Fire TV (see below)
python assemble.py       # cut both, lay the narration, normalise
python subtitle.py       # burn the captions
```

Output: `build/everyword-demo-captioned.mp4`. Upload that one. The `.srt`
ships beside it for anyone who wants the text, but do not also upload it
to YouTube or a viewer enabling CC sees two stacked sets of captions.

## Why there are two recorders

The Fire TV track rule says the video has to show the project *running*
on a Fire TV device or the Fire TV simulator. So the television beats
are the release APK on a Fire TV that Amazon hosts and streams to a
browser (Appstore Quality Central, Live Device Interaction), driven
with the console's remote. The rest is the deployed website in a real
browser. `beats.py` decides which camera a beat belongs to; anything
whose action starts with `tv_` is device footage.

Both cameras produce 3840x2160, so neither is scaled when they are cut
together.

## The Fire TV take

`drive_qc.py` opens Chrome on the Developer Console with the profile
Earshot's console work signed in with (sibling project, same account),
then polls `build/qc-cmd.txt` once a second for one command per line:
`click`, `clickat`, `press`, `fclick` (text in any frame), `upload` (the
APK, into the Dashboard's file input), `shell` (the Dashboard's ADB
Shell box), `shot`, `take`, `quit`. After each, a screenshot lands at
`build/qc-state.png` and a line in `build/qc-drive.log`, so whoever is
driving looks before the next step. Sign-ins are a person's.

The device's first-run setup ignores the remote, so the order is:
pick a device, upload the APK, `shell am start -n
com.everywordtv/.MainActivity`, then `take`. `qc_take.py` plays the four
television beats, with nothing cropped: every frame is the whole console
page under an address bar showing its real address, with the device's
name, the on-screen remote and the stream inside it. That is the point
of shooting it this way: a viewer can see where the footage came from.

### Traps, each of which cost a take

**Chrome's recording of the console runs well behind the clock** (eleven
seconds on Earshot's take) and drops its last seconds when the context
closes. So the take claps a green square before the first beat and
after the last, finds both in the file, maps every mark through the
line between them, and holds sixteen seconds past the last beat for the
recorder to catch up.

**The stream stops updating without key presses.** Every hold presses
Up every four seconds, a key no screen of this app does anything with.

**A click on the stream is a tap on the device.** The take focuses the
stream by clicking the app's header, not its middle, because a click in
the middle of the library opens a story.

**The app's "Back to stories" button opened the next story** on the
hosted device: the key-up of the press landed on the library that had
just mounted. The take uses the remote's own Back instead, which the
app answers since v0.3.2 (before that it quit the app; friction log
entry 16).

**Chrome caps the capture at twice device scale**, so a 1600x900 window
at 2.4x records 3200x1800 content in the corner of a grey 4K file.
`qc_take.py` crops that and scales it 1.13x under the bar.

## The web take

`record.py` records the live site, not a local build, at 3840x2160
with the page laid out as at 1920x1080 and zoomed twice, so type is
drawn at 4K rather than scaled to it. Playwright's picture starts
seconds before the recorder's clock and the gap differs by the day, so
the take claps a white square before the first beat and re-aligns
every mark from where the square appears in the file.

## Nothing is ever sped up

`assemble.py` removes only screen that has already settled with nothing
being said over it. A step that genuinely took eleven seconds still looks
like eleven seconds, because a screen recording played fast is a lie
about how quick the product is.

The audio is built from the picture, never the other way round: each beat
is cut to its own narration length, and the narration is then laid at the
second that beat actually begins in the finished cut. The two tracks
cannot drift.

`record_tv.py` is the earlier recorder for an Android TV virtual device
and is kept for a machine without console access; its footage is not a
Fire TV and the September video that used it was replaced.
