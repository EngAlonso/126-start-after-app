---
name: Fnashha Expo Android build environment
description: Android APK builds require an Android SDK and Gradle toolchain that may not be present in the Replit workspace.
---

An Expo Android preview can run through Metro/Expo Go even when this workspace cannot compile a local APK. A local APK build requires Java plus Android SDK tools and Gradle; do not create native folders or claim a build succeeded when those tools are absent.

**Why:** The imported project had a healthy Expo workflow and valid Android config, but the workspace lacked Java, Android SDK, adb/aapt, Gradle, and native Android files.

**How to apply:** Before attempting an APK build, verify the Android toolchain independently of Metro. If it is unavailable, report an environment blocker and leave the Expo source unchanged.