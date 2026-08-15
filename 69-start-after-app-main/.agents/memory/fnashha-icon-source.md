---
name: Fnashha application icon source
description: Canonical source and generation rule for the app's web, Expo, Capacitor, and Flutter icon assets.
---

The uploaded high-resolution logo is the canonical source for every application icon, favicon, launcher asset, and splash-logo asset. The checked-in generator must resize directly from that source; it must not use an already-generated icon or a lower-resolution project logo as an intermediate source.

**Why:** Regenerating from an existing small icon compounds interpolation loss and can silently restore an outdated logo when platform assets are rebuilt.

**How to apply:** Use `artifacts/fnashha/scripts/generate-assets.sh` for future regeneration. Android adaptive foreground assets may use a transparent safe-zone canvas because Android applies its own mask; all other icon variants should preserve the uploaded logo's design, colors, padding, and proportions.