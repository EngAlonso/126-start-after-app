---
name: Expo notification startup
description: Durable rules for handling Expo push-notification taps during app startup.
---

Cold-start push responses must be retained until authentication restoration, any required intro flow, and Expo Router readiness have completed. They should then pass through the same notification-to-route mapper used for warm starts.

**Why:** Expo can deliver the launch response before the navigation tree and auth state are ready. Independent intro/root redirects or timer-based pushes can expose intermediate frames and replace the intended destination with a role home.

**How to apply:** Keep the root layout as the single owner of startup intro gating, use readiness signals instead of arbitrary delays, and guard auth redirects while a notification destination is being handed to the router.