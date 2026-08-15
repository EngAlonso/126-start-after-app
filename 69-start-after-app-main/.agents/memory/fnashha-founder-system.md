---
name: Fnashha Founder Account System
description: How the Founder account works — DB flag, bootstrap, JWT, protection guards, settings endpoint, and frontend route.
---

## Rule
The Founder is identified by `is_founder = TRUE` in `users` (DB role stays `super_admin`).
Only ONE row may ever have this flag (enforced by a partial unique index in bootstrap DDL).
All hardcoded credentials and `applySuperAdminOverride` logic have been removed.

**Why:** Hardcoded credentials are a security liability. A DB-backed Founder identity survives phone/password changes and is auditable.

## How to apply

### DB schema
- `usersTable` in `lib/db/src/schema/index.ts` has `isFounder: boolean("is_founder").notNull().default(false)`.
- Bootstrap DDL (in `bootstrap.ts`) adds `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE` and a partial unique index `users_founder_uniq`.

### Bootstrap (3-step idempotent)
Runs at startup in `bootstrapFounder()`:
1. `SELECT id FROM users WHERE is_founder = TRUE` → if exists, skip.
2. `SELECT id FROM users WHERE mobile = $FOUNDER_PHONE` → if found, `UPDATE … SET is_founder=TRUE, role='super_admin'`.
3. Otherwise `INSERT INTO users … is_founder=TRUE`.
Missing `FOUNDER_PHONE` or `FOUNDER_PASSWORD` → logs a warning, skips.

### JWT
`isFounder` is embedded in the token payload by `signToken()` in `auth.ts`.
`SESSION_SECRET` is required at startup (`index.ts` throws if missing — no hardcoded fallback).

### Backend protection pattern
Every mutating endpoint that accepts a user ID (`users.ts`, `analytics.ts`) does:
```ts
const [targetCheck] = await db.select({ isFounder: usersTable.isFounder })
  .from(usersTable).where(eq(usersTable.id, id)).limit(1);
if (targetCheck?.isFounder) return res.status(404).json({ error: "..." });
```
Returns 404 (not 403) so existence is not revealed.

GET /users list: permanently includes `eq(usersTable.isFounder, false)`.
Staff list (`/admin/staff`): includes `eq(usersTable.isFounder, false)`.

### Founder-only endpoint
`PATCH /api/founder/settings` in `routes/founder.ts`:
- Guarded by `requireFounder` middleware (checks `req.user.isFounder`).
- Verifies DB flag again for defence-in-depth.
- Can change password, phone, or both.
- Phone change requires `currentPassword` for verification.
- Always forces `isFounder = true` on the UPDATE to prevent accidental flag loss.

### SSE events
`routes/events.ts` no longer has `SUPER_ADMIN_MOBILE` or role-override logic.
JWT is trusted as-is (Founder has `role: "super_admin"` in the token).

### Frontend
- `auth-context.tsx`: `isFounder: (currentUser as any)?.isFounder === true` computed from cached user.
- `App.tsx`: `ProtectedFounder` guard wraps `/founder/settings` route.
- `AdminLayout` sidebar: "المؤسس" section with "إعدادات المؤسس" link, visible only when `isFounder`.
- `pages/founder/settings.tsx`: two independent forms — password change and phone change.

## Token staleness after phone change
After a phone change the JWT still carries the old mobile. This is benign: `mobile` in the JWT is informational only; all authorization uses `id` + `isFounder`. The frontend will get the correct phone on the next `/auth/me` call or re-login.
