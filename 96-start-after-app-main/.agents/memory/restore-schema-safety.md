---
name: Restore schema safety
description: Durable rule for local database restore ordering and bootstrap behavior.
---

The existing idempotent bootstrap remains the schema synchronization mechanism. Restore must invoke that mechanism without running unrelated startup actions, then verify the required tables and Drizzle-declared columns before creating a safety backup or deleting data.

**Why:** Startup bootstrap intentionally remains non-fatal for degraded-mode application behavior, so Restore needs its own explicit fail-closed boundary.

**How to apply:** Keep schema synchronization and restore preflight narrow and non-destructive. Do not replace the backup format or introduce a second migration system for this workflow.