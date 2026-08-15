---
name: Fnashha loyalty engine
description: Phase 2–6 loyalty engine implementation details and critical patterns for earnCoins, idempotency, and completion hook.
---

# Fnashha Loyalty Engine

## Phase 2 Engine Functions
All in `artifacts/api-server/src/lib/loyaltyEngine.ts`:
- `getLoyaltyConfig()` — reads 12 CMS loyalty keys with LOYALTY_DEFAULTS fallback
- `generateReferralCode()` — unique 8-char alphanumeric with collision retry
- `seedCustomerWallet()` — creates wallet row on customer registration
- `earnCoins()` — full earn logic; see below for concurrency design
- `cancelPendingCoins()` — cancels pending coins on request cancel
- `triggerReferralReward()` — grants referral bonuses on first full-price request; uses atomic UPDATE-WHERE-RETURNING on referrals table

## Phase 6 Completion Hook (requests.ts POST /requests/:id/complete)
Key design decisions made and code-reviewed:

### 1. Authorization
Only the owning customer may call complete:
```typescript
if (user.role !== "customer" || request.customerId !== user.id) {
  return res.status(403)...
}
```

### 2. Atomic Status Transition
UPDATE uses WHERE status='waiting_approval' + RETURNING to detect races:
```typescript
const [updated] = await db.update(serviceRequestsTable)
  .set({ status: "completed" })
  .where(and(eq(...id), eq(...status, "waiting_approval")))
  .returning({ id: serviceRequestsTable.id });
if (!updated) return res.status(409)...
```

### 3. Independent Failure Domains in Secondary Ops
Three separate try-catch blocks: config load, earnCoins, triggerReferralReward.
triggerReferralReward runs even if earnCoins fails.

### 4. earnCoins Concurrency Safety (belt-and-suspenders)
- `SELECT FOR UPDATE` on customer_wallets row serializes concurrent calls for same userId at DB level
- Idempotency guard (SELECT for existing earn txn by requestId) runs INSIDE the lock — race-free
- Return 0 if already awarded (no wallet mutation)

**Why:** READ COMMITTED isolation allows two concurrent transactions to both pass a plain SELECT check. The wallet row lock forces serialization so only one transaction can execute the idempotency check + insert at a time.

**How to apply:** Any new "earn once per event" pattern should use SELECT FOR UPDATE + post-lock existence check.
