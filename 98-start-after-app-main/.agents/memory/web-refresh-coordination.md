---
name: Web refresh coordination
description: Durable constraint for the web authentication refresh flow.
---

The web app stores one rotated refresh token in shared localStorage, while each tab has its own in-memory refresh state. Access-token refresh must therefore coordinate across browser contexts and adopt tokens written by another context before attempting rotation.

**Why:** Server-side refresh-token rotation revokes the previous token and treats reuse as session theft, so simultaneous tab refreshes can invalidate the session.

**How to apply:** Keep single-tab in-flight deduplication, add browser-wide exclusive coordination, and synchronize token changes through localStorage events. Only log out after an actual refresh rejection when no newer token pair exists.