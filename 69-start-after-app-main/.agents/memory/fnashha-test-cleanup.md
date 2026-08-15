---
name: Fnashha test user cleanup order
description: Correct DB deletion order to avoid FK violations when tearing down test users.
---

## Rule
When deleting test users in scripts, always delete in this order:
1. `DELETE FROM service_requests WHERE customer_id IN (SELECT id FROM users WHERE mobile IN (...))` — cascades to `offers`, `messages`, `price_adjustments`, `audit_trail` (via `request_id` ON DELETE CASCADE)
2. `DELETE FROM point_transactions WHERE technician_id IN (SELECT id FROM technician_profiles WHERE user_id IN (SELECT id FROM users WHERE mobile IN (...)))` — no cascade on this FK
3. `DELETE FROM users WHERE mobile IN (...)` — cascades to `technician_profiles` (which cascades to nothing more after step 2), `notifications`, etc.

## Why
`audit_trail.changed_by → users(id)` has NO ON DELETE CASCADE. If you delete users directly while audit_trail rows still reference them via `changed_by`, PostgreSQL throws a FK violation. Deleting service_requests first removes those audit_trail rows via the `request_id` CASCADE.

`point_transactions.technician_id → technician_profiles(id)` also has no CASCADE, so those must be cleared before `technician_profiles` is dropped (which happens automatically when users are deleted).
