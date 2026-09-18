# EveryWord for Fire TV

The reader on the biggest screen in the house. Real public-domain content
with word-timed captions, rendered karaoke style: every word lights up at
the moment it is spoken, so watching becomes reading practice.

This replaces the React Native starter README that the CLI generates. That
file described how to run a generic React Native app and said nothing
about what this one is.

## What it is

A `react-native-tvos` app targeting **Fire OS**, sideloadable to any Fire
TV device as an APK. It plays Aesop's *The Two Pots*, read by LibriVox
volunteers, with captions produced by the EveryWord pipeline on Amazon
Transcribe.

It shares the renderer with the web reader rather than reimplementing it:

```tsx
import {KaraokeCaptionsNative} from 'karaoke-captions-react/src/native';
import {computeWordIndex, countWords} from '@everyword/captions-core';
```

Both packages are published on npm. The television and the browser light
the same word at the same millisecond because they run the same code.

## Ten-foot design

Everything is driven by the D-pad. No pointer, no small targets, no text
that assumes you are two feet from the screen. Focus is visible at all
times, because on a television a focus ring you cannot find is a dead end.

## Install it on a Fire TV

The published APK is multi-architecture and self-contained:

```
adb connect <your-fire-tv-ip>:5555
adb install everyword-tv-v0.1.0.apk
```

Download it from the [v0.1.0
release](https://github.com/usv240/everyword/releases/tag/v0.1.0).

## Build it yourself

```
npm install
npm run android
```

`metro.config.js` documents the monorepo wiring. This app lives outside
the npm workspaces on purpose: React Native's bundler and the workspace
hoisting disagree about which copy of React is the real one, and keeping
it out is less trouble than teaching them to agree.

`android/gradle.properties` builds `armeabi-v7a`, `arm64-v8a` and `x86_64`.
Do not narrow that to `x86_64` to speed up emulator builds. An earlier
release shipped exactly that and would have failed to install on every
real Fire TV with `INSTALL_FAILED_NO_MATCHING_ABIS`, while the README
invited people to sideload it. See `FRICTION_LOG.md`.

## What was tested, and what was not

No physical Fire TV was available during the build, so this was tested on
an Android Virtual Device, which is Amazon's own documented substitute.
That is a substitute and not the thing.

`docs/FIRE_TV_TARGET.md` states exactly what that does and does not prove,
and points at Appstore Quality Central's virtual device farm, which hosts
real Fire TV devices and accepts an uploaded APK.

## Vega OS

Not supported, and the reason is not laziness. Vega is Amazon's
Linux-based platform and an Android APK does not run on it; targeting it
means rebuilding against a different toolchain rather than re-running this
on another simulator. The Vega Virtual Device also had no Windows host at
the time of building. Both are documented in `docs/FIRE_TV_TARGET.md`.
