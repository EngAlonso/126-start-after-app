---
name: Acceptance query aggregation
description: Keep per-scenario target assertions and eligible-population totals in separate aggregates.
---

Read-only acceptance queries that report both grouped request counts and eligible-user totals must aggregate those result sets separately before joining them. Joining two one-to-many summaries directly can create a test-only fan-out and produce false failures.

**Why:** The campaign implementation correctly groups completed requests by customer, but a combined reporting join multiplied rows in the acceptance harness.

**How to apply:** Use separate target and population summaries, then join each one-to-one by scenario before asserting row counts and distinct-user counts.