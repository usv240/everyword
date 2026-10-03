# What EveryWord targets on Fire TV, and where it was tested

Stated plainly, because "it runs on TV" is not a claim a judge should have to take on trust.

## The target: Fire OS

The EveryWord TV app in `tv/` is a React Native app built with `react-native-tvos`. It compiles to an Android APK and targets **Fire OS**, the Android-based operating system on Fire TV Stick, Fire TV Cube, and Fire TV Edition televisions. The release APK is attached to the [v0.3.2 release](https://github.com/usv240/everyword/releases/tag/v0.3.2) and sideloads onto a Fire TV device with `adb install`.

This is a supported Fire TV path. The hackathon rules allow "React Native, web technologies, or Android (Kotlin/Java), any framework is fine, as long as it runs on Fire OS or Vega OS."

## Where it was tested, and why

Two places. During the build, an Android Virtual Device. For the demo video, an Amazon-hosted Fire TV, which is the stronger of the two and is described in the next section.

No physical Fire TV device was available during the build. Amazon's documented answer for exactly this case is the Android Virtual Device:

> "To emulate an Amazon device, you must create a new device definition and a new virtual device, in Android Virtual Device Manager."
>
> Amazon Developer Community, [How do I test my app?](https://community.amazondeveloper.com/t/how-do-i-test-my-app-emulator-beta-test-iap-physical-device/1779)

That is what we did. The virtual device is a `tv_1080p` profile running an Android TV system image at 1920x1080, driven entirely by D-pad, which is the interaction model Fire TV uses. Screenshot: `docs/screenshots/tv-emulator-karaoke.png`.

## The hosted Fire TV, where the demo was filmed

An Android Virtual Device is a generic Android TV image, not a Fire TV. It runs the app under the same interaction model and it is Amazon's documented substitute, but it is a substitute.

Amazon also hosts **real Fire TV devices you can drive from a browser**, through Appstore Quality Central's Live Device Interaction. The virtual-device farm accepts an uploaded APK and lets you sideload and run it:

> "Sideload and test APKs to observe app behavior during installation and uninstallation."
>
> Amazon Developer Docs, [Live Device Interaction](https://developer.amazon.com/docs/app-testing/live-device-interaction-virtual.html)

Getting there: Developer Console, then Tools and Services, then Appstore Quality Central, then Live Device Interaction, then a device. It needs the Developer Agreement and Device Handling Guidelines accepted once, a stable connection, and it releases the device after idle time.

On 2026-10-03 the release APK was uploaded from the console's Dashboard to a hosted **FOS 14 3P TV**, launched, driven with the console's remote, and filmed for the demo video with the whole console in frame (`docs/screenshots/tv-hosted-fire-tv.png`; the pipeline is in `video/README.md`). The rules accept "an actual Fire TV device or the Fire TV/Vega simulator" in the demo video, and footage of the APK running on an Amazon-hosted Fire TV is a straight answer to that where an Android Virtual Device is an argument about equivalence.

It earned its keep in the first five minutes. On the hosted device, pressing Back on the remote during a story quit the app. Fire OS sends Back as `KEYCODE_BACK`, which React Native delivers as `hardwareBackPress`, and v0.3.1 listened for the `menu` TV event, which Apple TV sends and Fire TV never does. The emulator never showed it because Back there had only been exercised through the on-screen button. Fixed in v0.3.2 with a `BackHandler` subscription, verified on the same hosted device before the footage was shot, and recorded as `FRICTION_LOG.md` entry 16. That is exactly the class of Fire OS difference the earlier version of this document warned about, and it was found by the environment this document said to use.

The device's progress reporting was checked the same way: the fable the television played during the take was reported to the deployed MCP server, and `get_reading_progress` for the television's reader lists that session.

The separate **physical** device farm is documented as "available to select partners only", and was not used.

**The honest limit that remains:** a hosted device is a real Fire TV running Fire OS, but it is one model, driven through a console rather than a remote in a hand, with no audio in the stream. EveryWord has not been submitted to the Amazon Appstore and would not be until it had run on a Fire TV Stick in a living room.

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
