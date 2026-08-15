---
name: Expo referral links
description: Production requirements for Fnashha HTTPS referral deep links.
---

The Expo app can capture and persist referral codes in source, but Android App Links and iOS Universal Links are not fully live until `fnashha.com` serves valid `assetlinks.json` and `apple-app-site-association` files for the installed app identifiers and signing identity.

**Why:** Native app configuration alone does not establish domain ownership; the operating systems verify the association files from the production domain.

**How to apply:** When validating or publishing referral links, check both `/.well-known/` endpoints and test cold/warm links on physical Android and iPhone devices. Keep the existing web `/r/CODE` route as the no-app fallback.