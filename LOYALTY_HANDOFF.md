# Loyalty System — Agent Handoff Document

> **Date produced:** 2026-07-06  
> **Status:** Phase 1 (database schema) complete. Phases 2–12 not started.  
> Full plan is in `LOYALTY_SYSTEM_PLAN.md` at the project root.

---

## 1. What Was Completed in Phase 1

- Added 5 new PostgreSQL enums to the Drizzle schema and to the bootstrap DDL.
- Added 2 new columns to existing tables (`users.referral_code`, `service_requests.has_discount`, `service_requests.customer_payable_amount`).
- Created 7 new tables in both the Drizzle schema and the bootstrap DDL.
- Updated the admin database backup/restore utility to include all new tables.
- Confirmed all tables, columns, and enums exist in the live database.

---

## 2. Files Modified

| File | What changed |
|---|---|
| `lib/db/src/schema/index.ts` | Added 5 enums, added `jsonb` import, added `referralCode` to `usersTable`, added `customerPayableAmount` + `hasDiscount` to `serviceRequestsTable`, added 7 new tables with full Drizzle relations, extended `usersRelations` and `serviceRequestsRelations` |
| `artifacts/api-server/src/lib/bootstrap.ts` | Removed broken `DO $$ BEGIN...END $$` multi-statement block; added new loyalty enums to the individual-statement autocommit loop; added `loyaltyDDL` block (runs after the enum loop) creating all 7 tables and the 3 new columns |
| `artifacts/api-server/src/routes/admin-database.ts` | Added all 7 new loyalty tables to both `ALL_TABLES` (backup/export/validate) and `RESTORE_ORDER` (restore sequence) in correct FK dependency order |
| `LOYALTY_SYSTEM_PLAN.md` | Created at project root; full design document; updated to reflect Phase 1 complete and two pre-Phase-2 architecture decisions |

---

## 3. Database Tables Added

All 7 tables exist in the live database.

| Table | Purpose |
|---|---|
| `customer_wallets` | One record per customer. Tracks `coins_balance` (available), `pending_coins` (locked until period elapses), `reserved_coins` (locked for active redemption), `lifetime_earned`, `lifetime_used`. |
| `coin_transactions` | Immutable log of every coin movement. Includes `source_type` + `source_id` for full traceability across origins (request, referral, campaign, manual, system). |
| `coin_redemptions` | One-to-one with a service request. Records the coin redemption applied before a request is confirmed. Tracks `coins_redeemed`, `discount_value`, and `status` (active / settled / reversed). |
| `credit_settlement_batches` | Groups platform credits for payment runs. Admin creates a batch, enters payment details, and marks a set of credits paid in one operation. |
| `platform_credits` | One record per request where coins were redeemed. Tracks the amount the platform owes the technician (to cover the discount gap), payment metadata, and batch linkage. |
| `referrals` | Tracks the referral relationship (referrer → referee), the referral code used, reward state, and the qualifying first request. |
| `campaigns` | Admin-created coin grant campaigns. Supports all-customer and manual targets; `segment_filter` is JSONB for future filter dimensions. |

---

## 4. Existing Tables Modified

| Table | Column added | Type | Notes |
|---|---|---|---|
| `users` | `referral_code` | `varchar(20) UNIQUE` | Generated once at registration; immutable |
| `service_requests` | `has_discount` | `boolean DEFAULT false` | Set to `true` by any discount path; gates coin-earning at completion |
| `service_requests` | `customer_payable_amount` | `numeric(10,2)` | Actual amount paid after discounts; see business rules below |

---

## 5. Enums Added

| Enum name | Values |
|---|---|
| `coin_tx_type` | `earn_pending`, `earn_available`, `system_cancel`, `redeem`, `redeem_reversal`, `referral_bonus`, `campaign`, `manual_credit`, `manual_debit`, `expiry` |
| `redemption_status` | `active`, `settled`, `reversed` |
| `credit_status` | `pending_settlement`, `paid` |
| `referral_status` | `pending`, `completed`, `fraud_flagged` |
| `campaign_target` | `all_customers`, `manual` |

---

## 6. Remaining Implementation Phases

Phases are numbered as in `LOYALTY_SYSTEM_PLAN.md` Section 13.

| Phase | Description | Key files |
|---|---|---|
| **2** | Add ~12 loyalty keys to `CMS_KEYS` whitelist in `cms.ts`; build admin loyalty settings page | `artifacts/api-server/src/routes/cms.ts` |
| **3** | Coin engine shared helper (earn rate calc, redemption calc, referral trigger) — analogous to `resolveCommissionRange` | New file, e.g. `src/lib/loyaltyEngine.ts` |
| **4** | Auth integration: generate referral code + seed wallet on customer registration; handle `referredBy` code at sign-up | `artifacts/api-server/src/routes/auth.ts` |
| **5** | Redemption API: `POST /loyalty/redeem`, `DELETE /loyalty/redeem/:requestId` | New route file |
| **6** | Request lifecycle hooks: completion (earn coins + settle platform credit + referral trigger), cancellation (coin reversal + pending coin cancel) | `artifacts/api-server/src/routes/requests.ts` |
| **7** | Platform credit settlement API + admin page | New route + frontend page |
| **8** | Referrals API + admin page | New route + frontend page |
| **9** | Campaigns API + admin page | New route + frontend page |
| **10** | Customer-facing wallet UI: balances, transaction history, redemption step during offer selection | Frontend, `artifacts/fnashha` |
| **11** | Pending coins cron job: `earn_pending` → `earn_available` after `pendingCoinDays` | API server startup, `node-cron` or `setInterval` |
| **12** | OpenAPI codegen + hook wiring: `pnpm --filter @workspace/api-spec run codegen` | `lib/api-spec` |

---

## 7. Important Business Rules That Must Not Change

### Pricing
- `agreedPrice` is the technician/customer contract price. **Never modified by discounts.**
- `customer_payable_amount` is what the customer actually pays after all discounts.
- **These two fields are always written together.** When an offer is accepted or a price adjustment is approved, both must be set simultaneously — `customer_payable_amount = agreedPrice` when no discount applies. It must **never be left NULL** after `agreedPrice` is set.
- The technician always earns `agreedPrice`. The platform covers the gap via `platform_credits`.

### Coin Earning
- Coins are earned **only** on full-price completed requests by default (`has_discount = false`).
- The CMS key `earnCoinsOnDiscount` (default `"false"`) is the only way to override this.
- Earning is blocked if `agreedPrice < minRequestValue`.
- `earnedCoins = floor(agreedPrice × coinConversionRatio)`, capped at `maxCoinsPerRequest`.

### Pending Coins
- If `pendingCoinDays > 0`, coins land in `pending_coins` as an `earn_pending` transaction with `expires_at` set.
- If `pendingCoinDays = 0`, coins go directly to `coins_balance` as `earn_available`.
- Pending coins are **automatically cancelled** (`system_cancel` transaction) if the originating request is cancelled before the waiting period ends.

### Referrals
- Referral code is generated once at registration and is **immutable** — no endpoint or admin action may change it.
- One referral code per new account enforced by `UNIQUE` on `referrals.referee_id`.
- Reward is granted **only** when the referee completes their first **full-price** request (`has_discount = false`).

### Platform Credits
- Always called **"Platform Credit"** or **"Fnashha Credit"** in all UI copy — never "compensation."
- `platform_credits.amount` always equals the corresponding `coin_redemptions.discount_value`.

### `has_discount`
- Any code that applies **any** discount of any type (coins, coupon, promotional, admin, campaign) **must** set `service_requests.has_discount = true`.
- This is the single, unambiguous gate for coin earning at completion.

---

## 8. Known Issues and Things the Next Agent Must Know

### Bootstrap DDL — critical pattern
The API server runs idempotent DDL on every startup via `bootstrap.ts`. All `CREATE TYPE` and `ALTER TYPE ADD VALUE` statements **must be individual `pool.query()` calls** inside a `for` loop with `try/catch`. A `DO $$ BEGIN...END $$` multi-statement block causes a **position-1941 syntax error** in this environment. This was fixed in Phase 1 — do not revert to the block pattern.

### Pre-existing non-fatal error on startup
The bootstrap logs `"syntax error at or near '$'"` at position 1941 on every startup. This is a **pre-existing error from before the loyalty work** and is unrelated to any loyalty DDL. It does not prevent the server from starting. Ignore it.

### Super admin has no database record
Super admin has `id = 0` with **no row in `users`**. Any FK pointing to `users.id` must use `null` when the actor is super admin. This applies to `coin_transactions.admin_id`, `platform_credits`, audit trail entries, and any other FK that records who performed an action.

### Secondary ops pattern
All new routes must follow the existing pattern: send `res.json()` **first**, then run notifications and audit logging in a nested `try/catch` afterwards. The outer `catch` must guard with `if (!res.headersSent)` before sending an error response.

### Generated API hook signature (OpenAPI / Orval)
Generated React Query hooks use **positional arguments, not objects**. Example: `useListMessages(requestId)`, not `useListMessages({ requestId })`. This applies to all hooks produced by `pnpm --filter @workspace/api-spec run codegen`.

### admin-database.ts must stay in sync
`ALL_TABLES` (backup/export/validate) and `RESTORE_ORDER` (restore sequence) in `artifacts/api-server/src/routes/admin-database.ts` must be updated whenever a new table is added. Both were updated in Phase 1 for the 7 loyalty tables. Do not add new tables without updating both arrays.

### `campaigns.segment_filter` is JSONB
The column type in the database is confirmed as `jsonb`. The Drizzle schema uses `jsonb("segment_filter")`. Do not treat it as `text`. New targeting dimensions are added as new JSON keys — no DDL change is needed.

### `customer_payable_amount` enforcement is application-layer work
The column exists in the DB (nullable). Enforcement of the "never NULL after offer acceptance" rule is **not yet implemented in code**. Phase 6 must ensure that wherever `agreedPrice` is written in `requests.ts` (offer selection, price adjustment approval), `customerPayableAmount` is written simultaneously with the same value.

### Wallet balance semantics (summary)
- `coins_balance` — spendable now (available).
- `pending_coins` — earned but held; incremented by `earn_pending`; decremented by `earn_available` or `system_cancel`.
- `reserved_coins` — locked for an active in-progress redemption; incremented at redeem, decremented at completion (permanent deduct) or cancellation (return to `coins_balance`).
- `lifetime_earned` — incremented on every earn event (pending or available).
- `lifetime_used` — incremented only when a redemption is permanently settled at request completion.
