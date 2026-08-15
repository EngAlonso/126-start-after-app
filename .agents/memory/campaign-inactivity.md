---
name: Campaign inactivity activity timestamp
description: Inactivity campaigns use completed request updated_at as the service-completion timestamp.
---

Inactive-customer campaigns treat a request as recent activity only when its status is `completed` and its `updated_at` falls within the execution window.

**Why:** Fnashha has no dedicated completed-at column; the completion transition writes `updated_at`, and existing completed-request views use that field for recency.

**How to apply:** Keep the anti-join limited to customer-owned requests with status `completed`; do not count drafts, cancelled requests, logins, notifications, or app opens.