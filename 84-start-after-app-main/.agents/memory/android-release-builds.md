---
name: Android release builds
description: Environment constraint discovered while preparing the Expo Android release build.
---

Android release builds cannot start until the workspace has a valid Android SDK location with the project’s required platform, build tools, and NDK components. The imported project may contain a complete native Android directory and Gradle cache while the environment still lacks `ANDROID_HOME`, `sdkmanager`, and the SDK itself.

**Why:** The native Gradle build fails during project configuration, before compilation, when no Android SDK can be found.

**How to apply:** Check for an SDK and required components before spending time on Gradle retries; do not repeatedly clear Gradle caches or alter the native project when the SDK is absent.