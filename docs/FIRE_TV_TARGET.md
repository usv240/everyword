# What EveryWord targets on Fire TV, and where it was tested

Stated plainly, because "it runs on TV" is not a claim a judge should have to take on trust.

## The target: Fire OS

The EveryWord TV app in `tv/` is a React Native app built with `react-native-tvos`. It compiles to an Android APK and targets **Fire OS**, the Android-based operating system on Fire TV Stick, Fire TV Cube, and Fire TV Edition televisions. The release APK is attached to the [v0.3.1 release](https://github.com/usv240/everyword/releases/tag/v0.3.1) and sideloads onto a Fire TV device with `adb install`.

This is a supported Fire TV path. The hackathon rules allow "React Native, web technologies, or Android (Kotlin/Java), any framework is fine, as long as it runs on Fire OS or Vega OS."

## Where it was tested, and why

No physical Fire TV device was available during the build. Amazon's documented answer for exactly this case is the Android Virtual Device:

> "To emulate an Amazon device, you must create a new device definition and a new virtual device, in Android Virtual Device Manager."
>
> Amazon Developer Community, [How do I test my app?](https://community.amazondeveloper.com/t/how-do-i-test-my-app-emulator-beta-test-iap-physical-device/1779)

That is what we did. The virtual device is a `tv_1080p` profile running an Android TV system image at 1920x1080, driven entirely by D-pad, which is the interaction model Fire TV uses. Screenshot: `docs/screenshots/tv-emulator-karaoke.png`.

## A stronger option we found late, and should use

An Android Virtual Device is a generic Android TV image, not a Fire TV. It runs the app under the same interaction model and it is Amazon's documented substitute, but it is a substitute.

Amazon also hosts **real Fire TV devices you can drive from a browser**, through Appstore Quality Central's Live Device Interaction. The virtual-device farm accepts an uploaded APK and lets you sideload and run it:

> "Sideload and test APKs to observe app behavior during installation and uninstallation."
>
> Amazon Developer Docs, [Live Device Interaction](https://developer.amazon.com/docs/app-testing/live-device-interaction-virtual.html)

Getting there: Developer Console, then Tools and Services, then Appstore Quality Central, then Get Started on the Virtual Devices card, then accept the Developer Agreement and Device Handling Guidelines. It needs a stable connection and disconnects after fifteen idle minutes.

The separate **physical** device farm is documented as "available to select partners only", so it may not be reachable. The virtual one carries no such restriction in its documentation.

This matters for the submission rather than for the code. The rules accept "an actual Fire TV device or the Fire TV/Vega simulator" in the demo video, and footage of the APK running on an Amazon-hosted Fire TV is a straight answer to that where an Android Virtual Device is an argument about equivalence. The multi-architecture APK already published is what that farm would install.

We found this while auditing the submission rather than while building, which is its own small lesson: the testing tools were a menu we never fully read.

**The honest limit:** an Android TV virtual device is not a Fire TV device. Fire OS differs from stock Android TV, most notably in WebView behaviour, and Amazon recommends testing on real hardware before publishing. EveryWord's TV app renders captions in native React Native views rather than a WebView, which is the area of largest known divergence, but this is a reason the app has not been submitted to the Amazon Appstore and would not be until it had run on real hardware.

We would rather state this precisely than let a screenshot imply hardware we never had.

## Why not Vega OS

Vega OS is the other Fire TV target, and it was not a realistic option here for two independent reasons.

**1. Vega OS is not Android.** It is Amazon's Linux-based platform for Fire TV devices, and apps must be rebuilt for it rather than ported. An Android APK does not run on the Vega Virtual Device. Targeting Vega would mean rewriting the TV app against a different toolchain, not re-running the existing one on a different simulator.

**2. The Vega SDK does not support Windows.** The Vega Developer Tools ship for macOS and Linux only, and the documentation states Windows and WSL are neither supported nor tested. This project was built on Windows 11. See `FRICTION_LOG.md` entry 12, filed as product feedback, because this excludes every Windows-only developer from the Vega track entirely.

Fire OS was therefore the correct and only available target, and it is a first-class one.

## The APK is built for real Fire TV hardware, and was not always

Worth recording because we got this wrong and only caught it by checking.

The v0.1.0 release originally shipped an APK containing `lib/x86_64/` only, because `reactNativeArchitectures` had been pinned to `x86_64` to keep emulator builds fast. Fire TV devices are ARM. That APK would have failed to install on every real Fire TV with `INSTALL_FAILED_NO_MATCHING_ABIS`, while the README cheerfully invited people to sideload it onto a Fire TV stick. An x86_64-only build is exactly the artifact you end up with if you only ever test on an emulator, which is the trap this whole document is about.

The published APK now carries all three ABIs:

```
lib/arm64-v8a/      newer Fire TV Stick, Fire TV Cube
lib/armeabi-v7a/    older 32-bit Fire TV Stick
lib/x86_64/         the Android Virtual Device
```

Verified with `aapt2 dump badging`, which also confirms the app is correctly shaped for a TV:

```
leanback-launchable-activity: com.everywordtv.MainActivity
uses-feature-not-required: android.hardware.touchscreen
uses-feature-not-required: android.hardware.faketouch
minSdkVersion: 24        Fire OS 6 and later
```

The leanback launcher entry is what puts the app on the Fire TV home screen, and declaring touchscreen not required is what stops Fire TV filtering the app out.

## What would close the gap

One Fire TV Stick and about five minutes:

```
adb connect <fire-tv-ip>:5555
adb install tv/android/app/build/outputs/apk/release/app-release.apk
```

Nothing in the app needs to change for that to work, and now nothing in the build does either. Only the footage would.
