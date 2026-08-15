---
name: Expo Android build environment
description: Imported Expo Android projects may need a provisioned SDK bundle and a local debug keystore before Gradle release packaging.
---

The Android SDK used by Gradle must be writable or include every dependency the build may request; a read-only SDK bundle causes failures when a transitive dependency needs an additional Build Tools version. Imported native projects may also omit the gitignored standard debug keystore expected by the release signing configuration.

**Why:** Release builds can pass compilation and lint, then fail only during dependency installation or final signing.

**How to apply:** Provision all required platform/build-tools/NDK/CMake versions together, point Gradle at that SDK, and generate the standard local debug keystore only when the project explicitly references it.