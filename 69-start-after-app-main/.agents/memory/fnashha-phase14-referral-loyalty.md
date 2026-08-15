---
name: Fnashha Phase 14 Referral & Loyalty Transparency
description: Key patterns and decisions from Phase 14 — referral links, coin expiry display, and admin financial settlement.
---

# Phase 14 — Referral System Completion & Loyalty Transparency

## Referral Link Format
`buildReferralLink()` in loyalty.ts now generates `/r/${referralCode}` (short-link format).  
The `/r/:code` route in App.tsx redirects to `/register/customer?ref=CODE`.  
**Why:** Avoids the /register → /register/customer handoff losing the ?ref= param (which register.tsx now also handles as defense-in-depth).

## Registration Referral Code Field Name
Backend (`auth.ts`) reads `req.body.referredBy` — the field must be called `referredBy`, not `referralCode`.  
Frontend (`register-customer.tsx`) reads `?ref=` URL param and exposes an optional `referredBy` field.

## Referral Statistics API
`GET /loyalty/referral-code` now returns:
- `statistics.rejected` = fraud_flagged count (not a separate "rejected" status in DB)
- `statistics.totalRewardsEarned` = sum of coin_transactions where sourceType='referral'
- `rewardHistory[]` = referrals joined to users for referee name, with referrerRewarded flag

## Coin Expiry in Wallet
- `/loyalty/transactions` already returned `expiresAt` per transaction
- `/loyalty/wallet` now also returns `nextExpiration: { amount, expiresAt } | null`
- Query: `earn_available` type, `expiresAt IS NOT NULL`, `expiredAt IS NULL`, `expiresAt > now()`, order by expiresAt ASC limit 1
- Frontend `daysUntil()` helper rounds up with Math.ceil

## Admin Financial Settlement Section
- Uses existing `GET /api/requests/:id/platform-credit` endpoint (already gated to admin + assigned tech)
- Admin fetches it on mount for all requests (returns `{ hasCoinDiscount: false }` when no coins were used)
- Financial card shows only when `hasCoinDiscount === true`
- Amounts: agreedPrice = customerPayableAmount + platformCreditAmount (by construction)
- Technician always earns the full agreedPrice (platform covers the coin discount portion)
