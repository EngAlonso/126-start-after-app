---
name: Expo build validation
description: Environment-specific constraints when validating the Expo artifact with its static build script.
---

The static Expo build script assumes Metro can use localhost port 8081, while the mockup preview workflow may already occupy that port. Its bundle generation can succeed for iOS and Android while the later manifest step fails in a bare workflow that still uses the `runtimeVersion` policy form.

**Why:** This environment has a separate mockup server on 8081, and Expo's manifest endpoint rejects policy-based runtime versions in the existing bare configuration.

**How to apply:** Temporarily stop the mockup workflow for a full static build, restore it afterward, and report bundle success separately from a manifest-only failure unless the user explicitly asks to change Expo runtime configuration.