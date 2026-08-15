---
name: Android build environment
description: Local Expo Android source audits may be possible without the Android SDK, but APK packaging verification requires an SDK-enabled build environment.
---

The workspace can contain a complete generated Expo Android project while still lacking Android SDK platform/build-tools packages; Gradle then fails before resource compilation with a missing `sdk.dir`/`ANDROID_HOME` error.

**Why:** Imported projects do not necessarily include an APK or a usable local Android SDK, so source/resource validation and APK validation are separate checks.

**How to apply:** When a task requires inspecting a Release APK, first confirm an SDK and APK are available. If not, finish source/config/resource checks and explicitly leave APK packaging as an environment-dependent follow-up rather than claiming it was verified.