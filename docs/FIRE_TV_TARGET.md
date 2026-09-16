# What EveryWord targets on Fire TV, and where it was tested

Stated plainly, because "it runs on TV" is not a claim a judge should have to take on trust.

## The target: Fire OS

The EveryWord TV app in `tv/` is a React Native app built with `react-native-tvos`. It compiles to an Android APK and targets **Fire OS**, the Android-based operating system on Fire TV Stick, Fire TV Cube, and Fire TV Edition televisions. The release APK is attached to the [v0.1.0 release](https://github.com/usv240/everyword/releases/tag/v0.1.0) and sideloads onto a Fire TV device with `adb install`.

This is a supported Fire TV path. The hackathon rules allow "React Native, web technologies, or Android (Kotlin/Java), any framework is fine, as long as it runs on Fire OS or Vega OS."

## Where it was tested, and why

No physical Fire TV device was available during the build. Amazon's documented answer for exactly this case is the Android Virtual Device:

> "To emulate an Amazon device, you must create a new device definition and a new virtual device, in Android Virtual Device Manager."
>
> Amazon Developer Community, [How do I test my app?](https://community.amazondeveloper.com/t/how-do-i-test-my-app-emulator-beta-test-iap-physical-device/1779)

That is what we did. The virtual device is a `tv_1080p` profile running an Android TV system image at 1920x1080, driven entirely by D-pad, which is the interaction model Fire TV uses. Screenshot: `docs/screenshots/tv-emulator-karaoke.png`.

**The honest limit:** an Android TV virtual device is not a Fire TV device. Fire OS differs from stock Android TV, most notably in WebView behaviour, and Amazon recommends testing on real hardware before publishing. EveryWord's TV app renders captions in native React Native views rather than a WebView, which is the area of largest known divergence, but this is a reason the app has not been submitted to the Amazon Appstore and would not be until it had run on real hardware.

We would rather state this precisely than let a screenshot imply hardware we never had.

## Why not Vega OS

Vega OS is the other Fire TV target, and it was not a realistic option here for two independent reasons.

**1. Vega OS is not Android.** It is Amazon's Linux-based platform for Fire TV devices, and apps must be rebuilt for it rather than ported. An Android APK does not run on the Vega Virtual Device. Targeting Vega would mean rewriting the TV app against a different toolchain, not re-running the existing one on a different simulator.

**2. The Vega SDK does not support Windows.** The Vega Developer Tools ship for macOS and Linux only, and the documentation states Windows and WSL are neither supported nor tested. This project was built on Windows 11. See `FRICTION_LOG.md` entry 12, filed as product feedback, because this excludes every Windows-only developer from the Vega track entirely.

Fire OS was therefore the correct and only available target, and it is a first-class one.

## What would close the gap

One Fire TV Stick and about five minutes. The APK is built, ADB is configured, and the sideload is a single command:

```
adb connect <fire-tv-ip>:5555
adb install tv/android/app/build/outputs/apk/release/app-release.apk
```

Nothing in the app needs to change for that to work. Only the footage would.
