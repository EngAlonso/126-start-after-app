---
name: Fnashha Expo logout navigation
description: Required post-logout navigation behavior for the Expo app.
---

After authentication cleanup completes, Expo logout must mark the intro as handled for the current JS session, dismiss the existing navigation stack, and replace the route with the public root `/`.

**Why:** A plain `router.replace('/')` can leave protected routes reachable through Back, and the guest root's cold-launch intro check can replay the intro after logout.

**How to apply:** Keep token/session clearing, query-cache clearing, and the best-effort server logout request in the existing account handler. Use the shared navigation helper only after `await logout()`; do not change `AuthContext` or the cold-launch intro persistence behavior.