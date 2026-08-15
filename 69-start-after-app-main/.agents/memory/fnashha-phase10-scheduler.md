---
name: Fnashha Phase 10 scheduler concurrency
description: Phase 10 loyalty scheduler implementation — concurrency model, FOR UPDATE coverage, and idempotency gates
---

## What Phase 10 Added

- `maturePendingCoins()` — converts `earn_pending` → `earn_available` when `expires_at` elapses
- `expireAvailableCoins()` — expires `earn_available` transactions when `expires_at` elapses (only if set)
- `loyaltyScheduler.ts` — `startLoyaltyScheduler()` uses `node-cron` (`*/30 * * * *` maturation, `0 * * * *` hourly expiry); runs both jobs once immediately on startup too, and wraps each tick in try/catch so a failure never crashes the API — it just logs and resumes next tick. Verified idempotent via manual double-trigger test (2nd run always processed=0).
- `POST /loyalty/admin/run-scheduler` — manual trigger; requires `loyalty.manage` permission
- `coinExpiryDays` CMS key — days before available coins expire; 0 = never
- `matured_at` / `expired_at` nullable columns on `coin_transactions` — set by scheduler when processing rows
- Partial indexes on `coin_transactions` for scheduler efficiency

## Concurrency Model — every wallet mutation now uses SELECT FOR UPDATE

All paths that mutate `customer_wallets`:
- `earnCoins()` ✓ (had it from Phase 2)
- `reserveCoins()` ✓ (FIXED in Phase 10)
- `releaseReservedCoins()` ✓ (FIXED in Phase 10)
- `cancelPendingCoins()` ✓ (FIXED in Phase 10)
- `_grantReferralCoins()` ✓ (FIXED in Phase 10)
- `maturePendingCoins()` ✓ (Phase 10 new)
- `expireAvailableCoins()` ✓ (Phase 10 new)
- Campaign execution in `loyalty.ts` ✓ (FIXED in Phase 10 — was using pre-fetched snapshot)

## Idempotency Pattern

Scheduler functions use UPDATE-RETURNING as idempotency gate:
```sql
UPDATE coin_transactions SET cancelled=true, matured_at=now()
WHERE id=$1 AND cancelled=false
RETURNING id
```
If the row was already claimed by a concurrent run, RETURNING is empty → skip.

## coinExpiryDays usage

- If `coinExpiryDays > 0`: `earn_available` transactions get `expires_at = created_at + coinExpiryDays days`
- `earnCoins()` sets `expiresAt` on direct earn_available transactions
- `maturePendingCoins()` sets `expiresAt` on the newly created earn_available transactions
- Scheduler query: `WHERE type='earn_available' AND cancelled=false AND expires_at IS NOT NULL AND expires_at <= NOW()`
- NULL `expires_at` means the coin never expires

**Why:** Coins without an explicit expires_at must never expire — only coins explicitly assigned an expiry date are eligible for the expiry scheduler.
