---
name: Workspace dependency installation
description: Replit workspace install behavior when a non-runtime development dependency is blocked.
---

When a full workspace install is blocked by a package-firewall failure in a development-only package, install the target artifact with its workspace dependency closure from the existing lockfile instead of changing runtime dependencies.

**Why:** The mobile artifact can run without unrelated workspace tooling, while a full install can fail before creating any usable node_modules.

**How to apply:** Prefer `pnpm install --filter <artifact>... --frozen-lockfile` for the affected artifact and its local dependencies, then run the artifact's own compatibility checks.