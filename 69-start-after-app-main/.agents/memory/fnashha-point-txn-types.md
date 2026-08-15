---
name: Fnashha Point Transaction Types
description: DB enum values, actor recording rules, and FK constraints for point_transactions.
---

## Enum values
`point_transaction_type` has: `"credit"`, `"debit"`, `"commission"`, `"release"`.

## Actor recording — CRITICAL
`point_transactions.admin_id` is a FK → `users.id`. The Super Admin has **no users row** — JWT carries `id: 0`.

**Rule:** Never pass `adminId: req.user!.id` directly. Use `resolveActor()` in `points.ts`:
- `req.user!.id === 0` (Super Admin) → `{ adminId: null, performedBy: "Super Admin" }`
- `req.user!.id > 0` (regular admin) → `{ adminId: userId, performedBy: null }`

**Why:** FK `admin_id → users.id` rejects `admin_id = 0`. `performed_by` (text, nullable) stores the actor name when no FK row exists.

## Transaction atomicity
`points/add` and `points/deduct` wrap UPDATE + INSERT in `db.transaction()`. If INSERT fails, the balance UPDATE is rolled back.

## Design
- Offer submitted: `reservedPoints` increases — no transaction written
- Offer rejected/other tech selected: `reservedPoints` decreases + `"release"` transaction written
- Request completed: permanent deduction → `"commission"` transaction written
