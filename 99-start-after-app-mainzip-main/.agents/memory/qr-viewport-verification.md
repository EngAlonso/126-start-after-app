---
name: QR viewport verification
description: Verification constraints for the QR landing page in the Replit preview.
---

The QR page is covered by app-wide startup/install overlays during fresh browser captures, so visual screenshots can look clipped even when the QR layout is correctly contained. Verify the QR page after those overlays clear, and check document `scrollWidth`/`scrollHeight` plus the QR card and descendants' bounding rectangles at each target viewport.

**Why:** The preview can show the intro slideshow or install prompt over the QR card, which is not part of the QR page layout and can make a valid layout appear broken.

**How to apply:** For `/qr` mobile fixes, validate 390×844 and 360×800 with DOM bounds in addition to screenshots; verify desktop separately so the mobile-only rule does not change the desktop card.