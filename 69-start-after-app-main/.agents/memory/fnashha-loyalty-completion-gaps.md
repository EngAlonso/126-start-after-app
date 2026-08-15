---
name: Fnashha loyalty completion/cancellation gaps (resolved)
description: Real gaps found auditing the loyalty system against LOYALTY_SYSTEM_PLAN.md — coin redemption was never settled/reversed on request completion/cancellation, and customer_payable_amount was never written alongside agreedPrice.
---

An audit against LOYALTY_SYSTEM_PLAN.md / LOYALTY_HANDOFF.md found the redemption
lifecycle was only half-wired despite Phase 10 memory notes claiming completion:

- `POST /requests/:id/complete` earned coins and triggered referrals, but never
  settled an active `coin_redemptions` row — `reserved_coins` stayed locked
  forever and `platform_credits` (technician compensation for the discount gap)
  was never created. Fixed by adding `settleRedemption()` to loyaltyEngine.ts
  (claim active→settled, drop reserved_coins, bump lifetime_used, insert
  platform_credits) and calling it from the completion hook.
- `POST /requests/:id/cancel` never called `releaseReservedCoins()` or
  `cancelPendingCoins()` at all — an active redemption or pending earn on a
  cancelled request was simply orphaned.
- `customer_payable_amount` was never written alongside `agreedPrice` at offer
  acceptance (offers.ts select) or price-adjustment approval (requests.ts) —
  the exact known-issue flagged in LOYALTY_HANDOFF.md §8, still unresolved at
  audit time despite being listed complete in memory.
- The plan's batch platform-credit settlement endpoint
  (`POST /admin/loyalty/platform-credits/settle`) didn't exist — only
  per-credit mark-paid did, and `credit_settlement_batches` was unused.

**Why this matters:** when auditing a "complete" phase against its own plan
doc, verify the money-movement endpoints (`complete`/`cancel` hooks) actually
call the reversal/settlement helpers — a helper function existing in the
engine module doesn't mean it's wired into the route that should call it.

**How to apply:** before trusting a "Phase N done" memory note for a
financial/wallet system, grep the completion and cancellation routes for
calls to every settle/release/reverse helper the plan lists, not just that
the helper is defined.
