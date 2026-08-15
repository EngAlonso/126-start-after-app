---
name: Fnashha super admin FK constraint
description: Super admin (mobile 01200229946) has no DB record — uses id=0 — causing FK violations on any table that references users.id as NOT NULL.
---

## The rule
The super admin is intentionally code-only (see `auth.ts` and `bootstrap.ts`). Login bypasses the DB and issues a JWT with `id: 0`. Any table column with `NOT NULL REFERENCES users(id)` will throw a PostgreSQL FK violation when the admin inserts a row.

**Why:** The bootstrap comment says "Super admin is managed entirely in code — no DB record is created or expected." This was a deliberate design decision.

**How to apply:** Whenever a feature lets the admin write to a table with a FK column pointing at `users.id`:
1. Make that column nullable in the Drizzle schema (`integer("col").references(() => usersTable.id)` — drop `.notNull()`).
2. Add `ALTER TABLE t ALTER COLUMN col DROP NOT NULL;` to the `alterDDL` block in `bootstrap.ts`.
3. In the route, set `col: req.user!.id || null` so id=0 becomes null.
4. In the frontend, display a fallback label (e.g. `"الإدارة"`) when the sender/actor field is null.

**Fixed so far:**
- `ticket_replies.sender_id` — made nullable so admin support replies work.
- `messages.sender_id` — made nullable so admin chat messages work (see chat fix).
- `offers.technician_id` — made nullable so super_admin can submit offers on behalf; route uses `technicianId: isAdmin ? null : user.id`.
- `audit_trail.changed_by` — already nullable by design; routes must use `user.id === 0 ? null : user.id`.

**Other columns to watch:** `activity_logs.admin_id`, `point_transactions.admin_id` — all reference `users.id` and will fail if the super admin ever writes through those routes.
