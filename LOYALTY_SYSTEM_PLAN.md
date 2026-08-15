# Loyalty System — Implementation Plan

> **Status**: PLAN UPDATED — Phase 1 complete, Phase 2 approved pending two pre-Phase-2 architecture improvements.  
> Architecture is based on a full read of the existing codebase (schema, routes, CMS infrastructure, auth, offers, requests).  
> Last updated: two pre-Phase-2 architecture improvements — `customer_payable_amount` business rule (always equals `agreedPrice` when no discount); `campaigns.segment_filter` changed from TEXT to JSONB.

---

## 1. Architecture Overview

The loyalty system introduces **Customer Coins** (earning, spending, pending, referral) and **Platform Credits** (protecting technician earnings when customers redeem coins). It integrates into the existing Fnashha flow at the following touch-points:

| Touch-point | Existing file | What changes |
|---|---|---|
| Customer registration | `auth.ts` | Generate referral code; seed wallet record |
| CMS settings | `cms.ts` + `CMS_KEYS` | Add ~12 loyalty config keys |
| Offer submission | `offers.ts` | No change (coins are redeemed after selection) |
| Offer selection | `offers.ts` → `select` endpoint | Attach coin redemption step |
| Request completion | `requests.ts` → `complete` endpoint | Credit pending coins; settle platform credit |
| Request cancellation | `requests.ts` → `cancel` endpoint | Cancel pending coins |
| Admin dashboard | New admin pages | Loyalty settings, wallet explorer, platform credit, campaigns |

---

## 2. Database Schema — New Tables

### 2.1 `customer_wallets`

One record per customer. Created automatically on registration.

```sql
id                serial PRIMARY KEY
user_id           integer NOT NULL UNIQUE → users(id) ON DELETE CASCADE
coins_balance     integer NOT NULL DEFAULT 0   -- AVAILABLE: spendable right now
pending_coins     integer NOT NULL DEFAULT 0   -- PENDING: earned but locked until pending_period elapses
reserved_coins    integer NOT NULL DEFAULT 0   -- RESERVED: locked for an active in-progress redemption
lifetime_earned   integer NOT NULL DEFAULT 0   -- cumulative total ever credited (available + pending grants)
lifetime_used     integer NOT NULL DEFAULT 0   -- cumulative total ever spent (redeemed on requests)
created_at        timestamp NOT NULL DEFAULT now()
updated_at        timestamp NOT NULL DEFAULT now()
```

> **Wallet balance semantics:**
> - **Available** (`coins_balance`): coins the customer can spend right now.
> - **Pending** (`pending_coins`): earned from completed requests but held for the configured waiting period. Automatically move to Available when the period expires. Cancelled automatically if the originating request is reversed or invalidated before the period ends.
> - **Reserved** (`reserved_coins`): temporarily locked when a redemption is in progress (between redemption and request completion/cancellation). Released back to Available on cancellation; permanently deducted on completion.
> - **Lifetime Earned** (`lifetime_earned`): running total of all coins ever credited, including pending, referral, campaign, and manual grants.
> - **Lifetime Used** (`lifetime_used`): running total of all coins ever redeemed on requests.

> **Why a separate table, not columns on `users`?**  
> `usersTable` already has 14+ columns, is joined everywhere, and is the auth source-of-truth. Wallet data is financial, grows with new columns, and is only queried in loyalty-specific contexts. Separation keeps the auth hot-path lean, matches the same pattern used for `technicianProfilesTable`.

---

### 2.2 `coin_transactions`

Every coin movement for a customer is logged here (mirrors `point_transactions` for technicians).

```sql
id                serial PRIMARY KEY
wallet_id         integer NOT NULL → customer_wallets(id)
user_id           integer NOT NULL → users(id)   -- denormalized for easy queries
amount            integer NOT NULL               -- always positive
type              coin_tx_type_enum NOT NULL
description       text NOT NULL
balance_after     integer NOT NULL               -- available balance after this tx
source_type       varchar(50)                    -- traceability: 'request' | 'referral' | 'campaign' | 'manual' | 'system'
source_id         integer                        -- FK-less ref to the source record (requestId, referralId, campaignId, etc.)
request_id        integer → service_requests(id) -- kept for direct join convenience; mirrors source_id when source_type='request'
admin_id          integer → users(id)            -- for manual adjustments
performed_by      text                           -- label (system / admin name)
expires_at        timestamp                      -- for pending coins; null when already available
created_at        timestamp NOT NULL DEFAULT now()
```

> **`source_type` / `source_id` traceability:**  
> Every coin movement can be traced to its origin. `source_type` is a free-form label (`'request'`, `'referral'`, `'campaign'`, `'manual'`, `'system'`, or any future type) and `source_id` is the PK of the originating record. `request_id` is kept as a real FK for join convenience on the most common case; for other source types, `source_id` holds the ID and `source_type` disambiguates which table it references. This design avoids a polymorphic FK while still providing complete traceability.

**`coin_tx_type_enum`** values:
- `earn_pending` — coins earned but not yet available (held for pending period)
- `earn_available` — pending period elapsed; coins moved to available balance
- `system_cancel` — pending coins cancelled automatically (request reversed/invalidated before period ended)
- `redeem` — customer spent coins on a request
- `redeem_reversal` — coins returned to available when a request is cancelled post-redemption
- `referral_bonus` — referral reward for referrer or referee
- `campaign` — coins granted via admin campaign dispatch
- `manual_credit` — admin manual coin credit
- `manual_debit` — admin manual coin debit
- `expiry` — coins expired (future-proofing)

---

### 2.3 `coin_redemptions`

Records the coin redemption attached to a specific request. One-to-one with a service request (a request can have at most one coin redemption).

```sql
id                serial PRIMARY KEY
request_id        integer NOT NULL UNIQUE → service_requests(id)
user_id           integer NOT NULL → users(id)
coins_redeemed    integer NOT NULL
discount_value    numeric(10,2) NOT NULL   -- coins × conversion_ratio
status            redemption_status_enum NOT NULL DEFAULT 'active'
created_at        timestamp NOT NULL DEFAULT now()
settled_at        timestamp
```

**`redemption_status_enum`**: `active`, `settled`, `reversed`

---

### 2.4 `platform_credits`

One record per request where the platform covered a customer coin discount. Protects technician earnings.

```sql
id                  serial PRIMARY KEY
request_id          integer NOT NULL UNIQUE → service_requests(id)
technician_id       integer NOT NULL → users(id)
amount              numeric(10,2) NOT NULL       -- equals coin_redemptions.discount_value
status              credit_status_enum NOT NULL DEFAULT 'pending_settlement'
batch_id            integer → credit_settlement_batches(id)
payment_method      text                         -- e.g. 'bank_transfer', 'cash', 'instapay'
payment_date        timestamp                    -- actual date payment was made to technician
payment_reference   text                         -- bank ref, receipt number, etc.
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()
```

**`credit_status_enum`**: `pending_settlement`, `paid`

> **Payment fields clarification:**  
> `payment_date` is the real-world date the technician received payment (entered by admin at settlement time).  
> `payment_reference` is any external identifier (bank transfer ref, receipt number, etc.).  
> `payment_method` records how the payment was made.  
> `batch_id` links the credit to its `credit_settlement_batches` record so all credits in one payment run are grouped together.

---

### 2.5 `credit_settlement_batches`

Groups platform credits for payment runs.

```sql
id                serial PRIMARY KEY
label             text NOT NULL
total_amount      numeric(10,2) NOT NULL
credit_count      integer NOT NULL
created_by        integer → users(id)
created_at        timestamp NOT NULL DEFAULT now()
paid_at           timestamp
notes             text
```

---

### 2.6 `referrals`

Tracks the referral relationship and its reward state.

```sql
id                serial PRIMARY KEY
referrer_id       integer NOT NULL → users(id)
referee_id        integer NOT NULL UNIQUE → users(id)  -- one referrer per new user
referral_code     varchar(20) NOT NULL
status            referral_status_enum NOT NULL DEFAULT 'pending'
referrer_rewarded boolean NOT NULL DEFAULT false
referee_rewarded  boolean NOT NULL DEFAULT false
first_request_id  integer → service_requests(id)       -- the qualifying completed request
created_at        timestamp NOT NULL DEFAULT now()
rewarded_at       timestamp
```

**`referral_status_enum`**: `pending`, `completed`, `fraud_flagged`

> **Fraud prevention**: A referee must complete a full-price request before either party is rewarded. Only one referral code may be applied per new account (enforced by UNIQUE on `referee_id`). Multiple accounts from the same device/IP are detectable but deferred to a future rule engine.

---

### 2.7 `campaigns`

Admin-created coin grant campaigns.

```sql
id                serial PRIMARY KEY
name              text NOT NULL
name_ar           text NOT NULL
description       text
coins_amount      integer NOT NULL
target            campaign_target_enum NOT NULL   -- all_customers / segment / manual
segment_filter    jsonb                           -- future: filter criteria
is_active         boolean NOT NULL DEFAULT false
created_by        integer → users(id)
starts_at         timestamp
ends_at           timestamp
created_at        timestamp NOT NULL DEFAULT now()
```

**`campaign_target_enum`**: `all_customers`, `manual`

> **`segment_filter` as JSONB (pre-Phase-2 improvement):** Changed from `TEXT` to `JSONB`. PostgreSQL JSONB is indexed (GIN index applicable), queryable with native operators (`@>`, `->`, `?`), and validated at write time — TEXT is none of these. Future filter criteria require no schema change; a new filter type is just a new key inside the JSON object. Example shapes:
> ```json
> { "governorate_ids": [1, 3, 7] }
> { "service_category_ids": [2], "min_completed_requests": 3 }
> { "inactive_days": 90, "max_lifetime_spent": 500 }
> { "first_request_only": true }
> ```
> `null` means no filter (applies to all users in the `target` group).

---

### 2.8 Changes to existing tables

| Table | Column to add | Type | Reason |
|---|---|---|---|
| `users` | `referral_code` | `varchar(20) UNIQUE NOT NULL` | Generated once at registration; immutable thereafter |
| `service_requests` | `has_discount` | `boolean DEFAULT false` | Denormalized flag: true if ANY discount type was applied; blocks coin earn at completion |
| `service_requests` | `customer_payable_amount` | `numeric(10,2)` | Actual amount paid by customer after all discounts; technician always earns `agreedPrice` |

> **Pricing field clarity:**  
> `agreedPrice` (already exists) = the original price agreed between customer and technician. This never changes due to discounts.  
> `customer_payable_amount` (new) = what the customer actually pays after deducting coin redemptions, coupons, or any other discount.  
>
> **Business rule (pre-Phase-2 improvement):** `customer_payable_amount` is **never left NULL** after `agreedPrice` is set. The two fields are always written together: when an offer is accepted or a price adjustment is confirmed, `customer_payable_amount` is set to `agreedPrice`. When a discount is subsequently applied, `customer_payable_amount` is updated to `agreedPrice − totalDiscount`. This makes `customer_payable_amount` a reliable reporting and accounting field — no null-guarding required in any query.  
>
> The technician always earns `agreedPrice`. The platform covers the gap (`agreedPrice − customer_payable_amount`) via `platform_credits`.

> **Why `has_discount` on the request?** The completion handler in `requests.ts` needs a single, unambiguous signal covering ALL discount types (Coins, Coupon, Promotional, Admin, Campaign, or any future type). Storing it on the request avoids re-querying multiple discount tables and is consistent with how `adminSeen` and `cancelReason` already work. Any code that applies a discount — now or in the future — sets this flag to `true`.

---

## 3. CMS Settings — New Keys

These will be added to the `CMS_KEYS` whitelist in `cms.ts`. All stored as strings in `cms_settings`, parsed at read time.

| Key | Type | Default | Description |
|---|---|---|---|
| `loyaltyEnabled` | `"true"/"false"` | `"false"` | Master enable/disable |
| `coinName` | `string` | `"كوين"` | Display name for coins (Arabic) |
| `coinNameEn` | `string` | `"Coin"` | Display name (English) |
| `coinConversionRatio` | `number string` | `"0.1"` | 1 coin = X EGP discount |
| `maxCoinsPerRequest` | `number string` | `"500"` | Cap on coins redeemed per request |
| `minRequestValue` | `number string` | `"100"` | Minimum `agreedPrice` to allow coin redemption |
| `pendingCoinDays` | `number string` | `"0"` | Days before earned coins become available (0 = immediate) |
| `allowCoinsPlusCoupons` | `"true"/"false"` | `"false"` | Allow stacking coins + coupons |
| `earnCoinsOnDiscount` | `"true"/"false"` | `"false"` | Should coins be earned when any discount was applied |
| `referralReferrerCoins` | `number string` | `"100"` | Coins granted to the referrer |
| `referralRefereeCoins` | `number string` | `"50"` | Coins granted to the new customer |
| `referralEnabled` | `"true"/"false"` | `"true"` | Enable referral rewards |

> **Why CMS keys and not a new table?**  
> The existing `cms_settings` key-value infrastructure already handles exactly this pattern: admin edits via `PATCH /cms/settings`, returned via `GET /cms/settings`, consumed by the frontend via `useGetCmsSettings`. Creating a dedicated `loyalty_settings` table would duplicate this infrastructure for no gain. The business requirement explicitly says "prefer reusing the existing CMS/settings infrastructure."

---

## 4. API Routes — New & Modified

### 4.1 New: `/api/loyalty/*` (customer wallet & coins)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/loyalty/wallet` | customer | Return wallet balances + recent transactions |
| `POST` | `/loyalty/redeem` | customer | Redeem coins on a request (before confirming) |
| `DELETE` | `/loyalty/redeem/:requestId` | customer | Cancel a pending redemption |
| `GET` | `/loyalty/referral-code` | customer | Get own referral code + referral stats |

### 4.2 New: `/api/admin/loyalty/*` (admin management)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/loyalty/wallets` | admin | List all customer wallets (paginated) |
| `GET` | `/admin/loyalty/wallets/:userId` | admin | Single customer wallet + full transaction log |
| `POST` | `/admin/loyalty/wallets/:userId/adjust` | admin | Manual credit/debit |
| `GET` | `/admin/loyalty/platform-credits` | admin | List platform credits (filterable by status) |
| `POST` | `/admin/loyalty/platform-credits/settle` | admin | Create a settlement batch + mark credits as paid |
| `GET` | `/admin/loyalty/referrals` | admin | List referrals + fraud flags |
| `GET` | `/admin/loyalty/campaigns` | admin | List campaigns |
| `POST` | `/admin/loyalty/campaigns` | admin | Create campaign |
| `POST` | `/admin/loyalty/campaigns/:id/dispatch` | admin | Grant coins to all targets now |

### 4.3 Modified: existing routes

#### `POST /api/auth/register/customer`
- Generate a unique `referral_code` (8-char alphanumeric, collision-retry) and save to `users.referral_code`. **This code is set once at registration and is immutable — no endpoint or admin action may change it.** The column has a `UNIQUE` constraint and no update path in the API.
- If the registration body contains a `referredBy` code, look up the referrer, create a `referrals` record with `status: pending`.
- Create a `customer_wallets` record (all balances = 0).

#### `POST /requests/:requestId/offers/:offerId/select` (offers.ts)
- After selecting the technician, check if there is an active `coin_redemptions` record for this request.
- If yes and `allowCoinsPlusCoupons` is false and a coupon was also applied → reject redemption (return error or auto-cancel the coin redemption).
- Attach the redemption to the confirmed request; update `service_requests.has_discount = true` and `service_requests.final_customer_price`.
- Reserve `coins_redeemed` in `customer_wallets.reserved_coins`.

#### `POST /requests/:id/complete` (requests.ts)
- After existing commission deduction logic:
  1. If `coin_redemptions` record exists for this request with `status: active`:
     - Deduct `reserved_coins` from wallet permanently; log `redeem` coin transaction.
     - Create `platform_credits` record for technician (amount = `discount_value`).
     - Mark redemption as `settled`.
  2. Earn coins (if eligible):
     - **Rule**: Coins are earned ONLY when the customer pays the full `agreedPrice` with no discount of any kind.
     - Eligibility checks (all must pass):
       1. `loyaltyEnabled = true`
       2. `has_discount = false` **OR** (`has_discount = true` AND `earnCoinsOnDiscount = true`) — configurable override
       3. `agreedPrice >= minRequestValue`
     - If eligible: `earnedCoins = floor(agreedPrice × coinConversionRatio)`, capped at `maxCoinsPerRequest`.
     - If `pendingCoinDays > 0`: add `earnedCoins` to `pending_coins`, log `earn_pending` transaction with `expires_at = now() + pendingCoinDays days`; the cron job activates it later.
     - If `pendingCoinDays = 0`: add `earnedCoins` directly to `coins_balance`, log `earn_available` transaction immediately.
     - In both cases: increment `lifetime_earned` by `earnedCoins`.
  3. Check referral eligibility: if this customer has a `pending` referral record, mark it `completed`, grant both parties their referral coins.

#### `POST /requests/:id/cancel` (requests.ts)
- After existing release-reservation logic:
  - If a `coin_redemptions` record exists for this request with `status: active`:
    - Return `reserved_coins` to `coins_balance` in wallet.
    - Log `redeem_reversal` transaction.
    - Mark redemption as `reversed`.
  - If `earn_pending` transactions exist for this request (coins in pending): cancel them, reduce `pending_coins`.

---

## 5. Pending Coins Automation

### 5.1 Automatic Activation (Pending → Available)

When `pendingCoinDays > 0`, coins are earned as `earn_pending` with an `expires_at` timestamp set to `now() + pendingCoinDays days`. A lightweight scheduled job (using `node-cron` or a startup interval in the API server) runs periodically, queries for `coin_transactions` where `type = 'earn_pending'` and `expires_at <= now()` and not yet activated, then for each:

1. Adds `amount` to `customer_wallets.coins_balance`.
2. Subtracts `amount` from `customer_wallets.pending_coins`.
3. Logs a new `earn_available` transaction (with `source_type` / `source_id` matching the original `earn_pending` transaction).

If `pendingCoinDays = 0`, coins go directly to `coins_balance` as `earn_available` — no cron needed for that path.

The cron catches missed windows on server restart automatically.

### 5.2 Automatic Cancellation (Pending Coins Invalidated)

Pending coins must be cancelled automatically when the originating request is cancelled, reversed, or invalidated before the waiting period ends. This is handled in the existing cancellation hook (`POST /requests/:id/cancel`):

1. Query `coin_transactions` where `source_type = 'request'` and `source_id = requestId` and `type = 'earn_pending'`.
2. For each found transaction: subtract `amount` from `customer_wallets.pending_coins`.
3. Log a `system_cancel` transaction (new enum value) with matching `source_type` / `source_id`, so the cancellation is fully traceable.
4. Mark the original `earn_pending` transaction as cancelled (add a boolean `cancelled` column to `coin_transactions`, default `false`).

> **`coin_tx_type_enum` addition**: add `system_cancel` to cover automatic pending coin cancellations. This keeps the transaction log complete — every pending coin that disappears has a corresponding cancellation record.

---

## 6. Coin Redemption Flow (Customer UX)

```
Customer selects a technician offer
  └─> Frontend shows "Redeem Coins?" step (before final confirmation)
        └─> Customer enters coins to redeem (slider or input, max = min(balance, maxCoinsPerRequest, floor(agreedPrice × 100%)))
              └─> POST /api/loyalty/redeem  { requestId, coinsToRedeem }
                    ├─ Validates: loyaltyEnabled, balance, max cap, minRequestValue
                    ├─ Writes coin_redemptions record
                    ├─ Updates wallet: reserved_coins += coinsToRedeem
                    ├─ Sets service_requests.has_discount = true, customer_payable_amount = agreedPrice − coinDiscount
                    └─> Customer sees updated price summary → confirms request
```

The technician always sees `agreedPrice`. The customer pays `final_customer_price`. The difference is tracked in `platform_credits`.

---

## 7. Platform Credit Settlement (Admin UX)

Admin goes to `/admin/loyalty/platform-credits`:
- Filters by `status: pending_settlement`
- Selects credits to batch (or "select all pending")
- Enters `payment_method`, `payment_date`, and `payment_reference`
- Clicks "Settle" → creates a `credit_settlement_batches` record and links all selected credits to it, marking them `paid` with the provided payment details

---

## 8. Referral Flow

```
New customer registers → enters referral code at sign-up
  └─> referrals record created (status: pending)

New customer completes first request at full price
  └─> requests.ts complete handler checks:
        - has referral record with status: pending
        - request has_discount = false  (must be full price)
        └─> Mark referral status: completed
            Grant referrer referralReferrerCoins (available immediately)
            Grant referee referralRefereeCoins (available immediately)
```

**Fraud prevention built-in:**
- One referral code per new account (UNIQUE on `referee_id`)
- Reward only triggers on a **completed, full-price** request — not on registration alone
- Admin can flag a referral as `fraud_flagged` to block rewards

---

## 9. Admin Dashboard Pages

| Page | Route | Permission |
|---|---|---|
| Loyalty Settings | `/admin/loyalty/settings` | `super_admin` or new `loyalty.settings` |
| Customer Wallets | `/admin/loyalty/wallets` | `loyalty.view` |
| Platform Credits | `/admin/loyalty/credits` | `loyalty.credits` |
| Referrals | `/admin/loyalty/referrals` | `loyalty.view` |
| Campaigns | `/admin/loyalty/campaigns` | `loyalty.campaigns` |

New permissions to add to the permissions registry:
- `loyalty.settings` — configure loyalty system
- `loyalty.view` — view wallets + referrals
- `loyalty.adjust` — manual coin adjustments
- `loyalty.credits` — manage platform credit settlements
- `loyalty.campaigns` — create/dispatch campaigns

---

## 10. OpenAPI / Orval Code Generation

New routes will be added to `lib/api-spec`. After implementation, `pnpm --filter @workspace/api-spec run codegen` regenerates the React Query hooks used by the frontend. This is the existing pattern — no deviation.

---

## 11. What Is NOT Changing

- Technician point system (`pointsBalance`, `reservedPoints`, `pointTransactionsTable`) — untouched.
- Commission calculation (`resolveCommissionRange`) — untouched.
- Existing request status machine — untouched; only two side-effects are injected at `complete` and `cancel`.
- Auth and session infrastructure — untouched.
- Coupon system — coupons are mentioned in the business requirements as a potential future discount source that affects `has_discount`. Since coupons do not exist in the schema yet, the `has_discount` flag is designed to accommodate them when they are added, without needing a schema change at that time.

---

## 12. Architectural Decisions Summary

| Decision | Rationale |
|---|---|
| Separate `customer_wallets` table | Keeps auth hot-path lean; follows same pattern as `technician_profiles` |
| Both `agreedPrice` + `customer_payable_amount` on `service_requests` | `agreedPrice` is the technician/customer contract; `customer_payable_amount` is what the customer actually pays; both must be preserved separately |
| `customer_payable_amount` always equals `agreedPrice` when no discount | Business rule: the two fields are written together at offer acceptance; never left NULL; simplifies all reporting, accounting, and future calculations — no null-guarding anywhere |
| `has_discount` flag on `service_requests` | Single unambiguous signal covering ALL discount types; any discount source sets it; configurable via `earnCoinsOnDiscount` |
| Coins earned ONLY on full-price requests by default | Core business rule; `earnCoinsOnDiscount` CMS key makes this configurable per admin preference |
| Loyalty config in `cms_settings` | Explicitly requested; reuses existing admin PATCH/GET infrastructure |
| Platform credit term (not "compensation") | Per business requirement |
| `payment_method` + `payment_date` + `payment_reference` on `platform_credits` | Full financial audit trail for each technician credit payment |
| Referral code generated once at registration, immutable | No update path in API; enforced by UNIQUE constraint; prevents referral code manipulation |
| Referral requires first **completed, full-price** request | Fraud prevention; consistent with the "no coins on discounted requests" rule |
| Pending coins via cron in API server | No external dependency; catches missed windows on restart |
| Pending coins auto-cancelled on request reversal | Prevents phantom coins from cancelled requests becoming available later |
| `source_type` + `source_id` on `coin_transactions` | Full traceability for every coin movement regardless of origin type |
| `coin_redemptions` as a separate table | Decouples discount logic from request; allows reversal tracking independently |
| `campaigns.segment_filter` as JSONB (not TEXT) | Native PostgreSQL JSONB is indexed, queryable with operators, and type-validated at write; new targeting dimensions (governorate, activity, spend) are new JSON keys — no DDL change ever needed |

---

## 13. Implementation Phases (for reference when approval is given)

1. **Schema** — new tables, enum additions, new columns on `users` and `service_requests`, DB push
2. **CMS keys** — add loyalty keys to whitelist; admin settings page
3. **Customer wallet & coin transaction engine** — shared helper module (like `resolveCommissionRange`)
4. **Auth integration** — referral code generation, wallet seed on registration
5. **Redemption API** — `POST /loyalty/redeem`, `DELETE /loyalty/redeem/:requestId`
6. **Request lifecycle hooks** — completion (earn + settle credit + referral), cancellation (reversal)
7. **Platform credit settlement API + admin page**
8. **Referrals API + admin page**
9. **Campaigns API + admin page**
10. **Customer-facing wallet UI** (balances, history, redemption step)
11. **Pending coins cron job**
12. **OpenAPI codegen + hook wiring**

---

*Awaiting your approval before any code is written.*
