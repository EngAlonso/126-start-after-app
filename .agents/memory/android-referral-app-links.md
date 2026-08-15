---
name: Android referral app links
description: Android intent-filter path-prefix behavior for referral deep links.
---

Android `pathPrefix` matching is literal prefix matching, so `/r` also claims unrelated paths such as `/register` and `/refund-policy`. Use `/r/` when the app-link contract is only for referral URLs shaped like `/r/CODE`.

**Why:** A broad prefix can open the native app for ordinary web pages and prevent the intended browser fallback.

**How to apply:** When configuring Android App Links for referral routes, include the trailing slash and validate neighboring routes such as `/register`, `/refund-policy`, and `/robots.txt`.