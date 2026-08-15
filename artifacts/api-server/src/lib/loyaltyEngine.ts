/**
 * Loyalty Engine — Phase 2 + Phase 10
 *
 * Central helper module for all loyalty system business logic.
 * Analogous to resolveCommissionRange in offers.ts — imported by any
 * route that needs to touch coins, wallets, referrals, or config.
 *
 * Phase 2 delivers:
 *   • getLoyaltyConfig()         — parse all CMS loyalty keys
 *   • generateReferralCode()     — unique 8-char alphanumeric with collision retry
 *   • seedCustomerWallet()       — create wallet record on registration
 *   • earnCoins()                — complete earn logic (used by Phase 6 completion hook)
 *   • cancelPendingCoins()       — cancel pending coins on request cancel (Phase 6)
 *   • triggerReferralReward()    — grant referral bonuses on first full-price request (Phase 6)
 *
 * Phase 10 delivers:
 *   • maturePendingCoins()       — scheduler: earn_pending → earn_available when expires_at elapses
 *   • expireAvailableCoins()     — scheduler: earn_available → expiry when expires_at elapses
 *
 * Concurrency model (Phase 10):
 *   Every wallet mutation acquires SELECT ... FOR UPDATE on the wallet row inside
 *   a transaction.  This serialises all concurrent operations on the same wallet
 *   (reserve, release, mature, expire, cancel, referral grant) so no lost-update
 *   or phantom-balance race can occur.  Scheduler functions additionally use an
 *   UPDATE-RETURNING idempotency gate on the individual coin_transaction row so
 *   concurrent scheduler instances never double-process the same transaction.
 */

import { db } from "@workspace/db";
import {
  cmsSettingsTable,
  customerWalletsTable,
  coinTransactionsTable,
  coinRedemptionsTable,
  serviceRequestsTable,
  referralsTable,
  usersTable,
  platformCreditsTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";

// ─── Internal transaction type ────────────────────────────────────────────────
// Drizzle transactions expose the same query API as `db`; we use `any` to
// avoid complex generic gymnastics (consistent with how points.ts uses tx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

// ─── Loyalty Config ───────────────────────────────────────────────────────────

export interface LoyaltyConfig {
  loyaltyEnabled: boolean;
  coinName: string;            // Arabic display name  e.g. "عملات فنشها"
  coinNameEn: string;          // English display name e.g. "Fnashha Currency"
  // ── Earning formula ──────────────────────────────────────────────────────
  // Every coinEarnX EGP spent = coinEarnY coins earned
  // earnedCoins = floor(agreedPrice / coinEarnX * coinEarnY)
  coinEarnX: number;           // EGP per formula period  e.g. 10  → "every 10 EGP"
  coinEarnY: number;           // coins per formula period  e.g. 1  → "= 1 coin"
  // ── Redemption formula ───────────────────────────────────────────────────
  // Every coinRedeemX coins = coinRedeemY EGP discount
  // discount = coinsUsed / coinRedeemX * coinRedeemY
  // maxCoinsFromPrice = floor(agreedPrice / coinRedeemY * coinRedeemX)
  coinRedeemX: number;         // coins per formula period  e.g. 1  → "every 1 coin"
  coinRedeemY: number;         // EGP discount per formula period  e.g. 0.5  → "= 0.5 EGP"
  maxCoinsPerRequest: number;  // cap on coins redeemable per request
  minRequestValue: number;     // minimum agreedPrice to allow redemption / earning
  pendingCoinDays: number;     // 0 = immediate; >0 = pending period in days
  coinExpiryDays: number;      // 0 = never expires; >0 = available coins expire after N days
  allowCoinsPlusCoupons: boolean;
  earnCoinsOnDiscount: boolean;
  referralReferrerCoins: number;
  referralRefereeCoins: number;
  referralEnabled: boolean;
}

/** Default values — used when a CMS key has not been set yet */
const LOYALTY_DEFAULTS: LoyaltyConfig = {
  loyaltyEnabled: false,
  coinName: "عملات فنشها",
  coinNameEn: "Fnashha Currency",
  // Every 10 EGP = 1 coin  (earn formula defaults)
  coinEarnX: 10,
  coinEarnY: 1,
  // Every 1 coin = 0.5 EGP discount  (redemption formula defaults)
  coinRedeemX: 1,
  coinRedeemY: 0.5,
  maxCoinsPerRequest: 500,
  minRequestValue: 100,
  pendingCoinDays: 0,
  coinExpiryDays: 0,
  allowCoinsPlusCoupons: false,
  earnCoinsOnDiscount: false,
  referralReferrerCoins: 100,
  referralRefereeCoins: 50,
  referralEnabled: true,
};

const LOYALTY_CMS_KEYS = [
  "loyaltyEnabled",
  "coinName",
  "coinNameEn",
  "coinEarnX",
  "coinEarnY",
  "coinRedeemX",
  "coinRedeemY",
  "maxCoinsPerRequest",
  "minRequestValue",
  "pendingCoinDays",
  "coinExpiryDays",
  "allowCoinsPlusCoupons",
  "earnCoinsOnDiscount",
  "referralReferrerCoins",
  "referralRefereeCoins",
  "referralEnabled",
] as const;

/**
 * Read and parse all loyalty CMS settings from the database.
 * Falls back to LOYALTY_DEFAULTS for any key that is not yet set.
 * Call this once at the start of any request handler that needs loyalty logic,
 * then pass the returned object down to avoid repeated DB reads.
 */
export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const rows = await db
    .select()
    .from(cmsSettingsTable)
    .where(inArray(cmsSettingsTable.key, LOYALTY_CMS_KEYS as unknown as string[]));

  const map: Record<string, string | null> = {};
  for (const row of rows) map[row.key] = row.value ?? null;

  const bool = (key: string, def: boolean) => {
    const v = map[key];
    if (v === null || v === undefined) return def;
    return v === "true";
  };
  const num = (key: string, def: number) => {
    const v = map[key];
    if (v === null || v === undefined) return def;
    const n = parseFloat(v);
    return isNaN(n) ? def : n;
  };
  const str = (key: string, def: string) => map[key] ?? def;

  return {
    loyaltyEnabled:        bool("loyaltyEnabled",        LOYALTY_DEFAULTS.loyaltyEnabled),
    coinName:              str ("coinName",               LOYALTY_DEFAULTS.coinName),
    coinNameEn:            str ("coinNameEn",             LOYALTY_DEFAULTS.coinNameEn),
    coinEarnX:             num ("coinEarnX",              LOYALTY_DEFAULTS.coinEarnX),
    coinEarnY:             num ("coinEarnY",              LOYALTY_DEFAULTS.coinEarnY),
    coinRedeemX:           num ("coinRedeemX",            LOYALTY_DEFAULTS.coinRedeemX),
    coinRedeemY:           num ("coinRedeemY",            LOYALTY_DEFAULTS.coinRedeemY),
    maxCoinsPerRequest:    num ("maxCoinsPerRequest",     LOYALTY_DEFAULTS.maxCoinsPerRequest),
    minRequestValue:       num ("minRequestValue",        LOYALTY_DEFAULTS.minRequestValue),
    pendingCoinDays:       num ("pendingCoinDays",        LOYALTY_DEFAULTS.pendingCoinDays),
    coinExpiryDays:        num ("coinExpiryDays",         LOYALTY_DEFAULTS.coinExpiryDays),
    allowCoinsPlusCoupons: bool("allowCoinsPlusCoupons",  LOYALTY_DEFAULTS.allowCoinsPlusCoupons),
    earnCoinsOnDiscount:   bool("earnCoinsOnDiscount",    LOYALTY_DEFAULTS.earnCoinsOnDiscount),
    referralReferrerCoins: num ("referralReferrerCoins",  LOYALTY_DEFAULTS.referralReferrerCoins),
    referralRefereeCoins:  num ("referralRefereeCoins",   LOYALTY_DEFAULTS.referralRefereeCoins),
    referralEnabled:       bool("referralEnabled",        LOYALTY_DEFAULTS.referralEnabled),
  };
}

// ─── Referral Code Generation ─────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit I, O, 0, 1 to avoid visual confusion

function randomCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Generate a unique 8-character referral code.
 * Checks the DB for collisions and retries up to `maxRetries` times.
 * Statistically impossible to exhaust (32^8 ≈ 1 trillion codes).
 *
 * Caller must still handle a unique-constraint violation at insert time
 * (race between two concurrent registrations generating the same code).
 */
export async function generateReferralCode(maxRetries = 10): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = randomCode(8);
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("Failed to generate unique referral code after max retries");
}

// ─── Wallet Seeding ───────────────────────────────────────────────────────────

/**
 * Create a customer_wallets record (all balances = 0) for a newly registered customer.
 * Accepts an optional Drizzle transaction (`tx`) so it can run atomically with
 * the surrounding user-insert transaction in auth.ts.
 * Idempotent: uses ON CONFLICT DO NOTHING (UNIQUE on user_id).
 */
export async function seedCustomerWallet(userId: number, tx?: Tx): Promise<void> {
  const client = tx ?? db;
  await client
    .insert(customerWalletsTable)
    .values({ userId })
    .onConflictDoNothing();
}

// ─── Coin Earning (used by Phase 6 — requests.ts completion hook) ─────────────

interface EarnCoinsOptions {
  userId: number;
  requestId: number;
  agreedPrice: number;  // parsed number (not the raw DB numeric string)
  hasDiscount: boolean;
  config: LoyaltyConfig;
}

/**
 * Evaluate eligibility and credit earned coins after a request is completed.
 * Mutates customer_wallets and inserts a coin_transactions row.
 * Returns the number of coins earned (0 if ineligible).
 *
 * Business rules:
 *   1. loyaltyEnabled must be true
 *   2. has_discount must be false, OR earnCoinsOnDiscount must be true
 *   3. agreedPrice must be >= minRequestValue
 *   4. earnedCoins = floor(agreedPrice × coinConversionRatio), capped at maxCoinsPerRequest
 *   5. pendingCoinDays > 0 → earn_pending (expires_at = now + pendingCoinDays)
 *      pendingCoinDays = 0 → earn_available (immediately spendable)
 *   6. coinExpiryDays > 0 → earn_available gets expires_at = now + coinExpiryDays
 *
 * Concurrency: SELECT ... FOR UPDATE on wallet serialises concurrent earns.
 * Idempotency: checks for existing non-cancelled earn transaction for this requestId.
 */
export async function earnCoins(opts: EarnCoinsOptions): Promise<number> {
  const { userId, requestId, agreedPrice, hasDiscount, config } = opts;

  // ── Eligibility checks ──
  if (!config.loyaltyEnabled) return 0;
  if (hasDiscount && !config.earnCoinsOnDiscount) return 0;
  if (agreedPrice < config.minRequestValue) return 0;

  // ── Calculate earned coins using the formula: every coinEarnX EGP = coinEarnY coins ──
  const rawEarned = config.coinEarnX > 0
    ? Math.floor(agreedPrice / config.coinEarnX * config.coinEarnY)
    : 0;
  const earnedCoins = Math.min(rawEarned, config.maxCoinsPerRequest);
  if (earnedCoins <= 0) return 0;

  return await db.transaction(async (tx: Tx) => {
    // ── Lock wallet (serialise all concurrent wallet mutations) ──────────────
    // Try to find existing wallet; auto-seed for pre-loyalty customers
    let [wallet] = await tx
      .select()
      .from(customerWalletsTable)
      .where(eq(customerWalletsTable.userId, userId))
      .for("update")
      .limit(1);
    if (!wallet) {
      // Customer existed before the loyalty system was introduced — create wallet now
      await tx.insert(customerWalletsTable).values({ userId }).onConflictDoNothing();
      [wallet] = await tx
        .select()
        .from(customerWalletsTable)
        .where(eq(customerWalletsTable.userId, userId))
        .for("update")
        .limit(1);
      if (!wallet) return 0;
    }

    // ── Idempotency guard (safe inside the lock) ─────────────────────────────
    const [alreadyEarned] = await tx
      .select({ id: coinTransactionsTable.id })
      .from(coinTransactionsTable)
      .where(
        and(
          eq(coinTransactionsTable.requestId, requestId),
          inArray(coinTransactionsTable.type, ["earn_pending", "earn_available"]),
          eq(coinTransactionsTable.cancelled, false),
        )
      )
      .limit(1);
    if (alreadyEarned) return 0;

    const now = new Date();
    const isPending = config.pendingCoinDays > 0;

    if (isPending) {
      const matureAt = new Date(now.getTime() + config.pendingCoinDays * 24 * 60 * 60 * 1000);

      await tx
        .update(customerWalletsTable)
        .set({
          pendingCoins:   wallet.pendingCoins + earnedCoins,
          lifetimeEarned: wallet.lifetimeEarned + earnedCoins,
          updatedAt:      now,
        })
        .where(eq(customerWalletsTable.id, wallet.id));

      await tx.insert(coinTransactionsTable).values({
        walletId:    wallet.id,
        userId,
        amount:      earnedCoins,
        type:        "earn_pending",
        description: `عملات فنشها مكتسبة من الطلب #${requestId} — في انتظار ${config.pendingCoinDays} يوم`,
        balanceAfter: wallet.coinsBalance, // available balance unchanged while pending
        sourceType:  "request",
        sourceId:    requestId,
        requestId,
        performedBy: "system",
        expiresAt:   matureAt,   // when this earn_pending will mature into earn_available
      });
    } else {
      const newBalance = wallet.coinsBalance + earnedCoins;

      // Compute expiry for immediately-available coins (if coinExpiryDays > 0)
      const expiresAt =
        config.coinExpiryDays > 0
          ? new Date(now.getTime() + config.coinExpiryDays * 24 * 60 * 60 * 1000)
          : null;

      await tx
        .update(customerWalletsTable)
        .set({
          coinsBalance:   newBalance,
          lifetimeEarned: wallet.lifetimeEarned + earnedCoins,
          updatedAt:      now,
        })
        .where(eq(customerWalletsTable.id, wallet.id));

      await tx.insert(coinTransactionsTable).values({
        walletId:    wallet.id,
        userId,
        amount:      earnedCoins,
        type:        "earn_available",
        description: `عملات فنشها مكتسبة من الطلب #${requestId}`,
        balanceAfter: newBalance,
        sourceType:  "request",
        sourceId:    requestId,
        requestId,
        performedBy: "system",
        ...(expiresAt ? { expiresAt } : {}),
      });
    }

    return earnedCoins;
  });
}

// ─── Coin Reservation (Phase 4 — POST /loyalty/redeem) ───────────────────────

export interface ReserveCoinsResult {
  coinsReserved: number;
  discountValue: number;
  customerPayableAmount: number;
}

/**
 * Reserve coins against a service request.
 *
 * Atomic steps inside one transaction:
 *   1. SELECT wallet FOR UPDATE — serialises with expireAvailableCoins / maturePendingCoins.
 *   2. Re-validate balance under lock (race-condition guard).
 *   3. INSERT coin_redemptions (UNIQUE requestId prevents double-reserve).
 *   4. Move coins: available ↓, reserved ↑.
 *   5. Insert "redeem" coin_transaction.
 *   6. Update service_requests: customerPayableAmount, hasDiscount=true.
 *
 * Throws:
 *   "INSUFFICIENT_BALANCE" — balance dropped below required amount between
 *                             pre-check and this transaction.
 *   "WALLET_NOT_FOUND"     — defensive; should never happen post-registration.
 */
export async function reserveCoins(opts: {
  userId: number;
  requestId: number;
  coinsToReserve: number;
  agreedPrice: number;
  config: LoyaltyConfig;
}): Promise<ReserveCoinsResult> {
  const { userId, requestId, coinsToReserve, agreedPrice, config } = opts;

  return await db.transaction(async (tx: Tx) => {
    // ── Lock wallet first — prevents expireAvailableCoins / maturePendingCoins
    // from racing and causing lost-update or negative-balance bugs.
    const [wallet] = await tx
      .select()
      .from(customerWalletsTable)
      .where(eq(customerWalletsTable.userId, userId))
      .for("update")
      .limit(1);

    if (!wallet) throw new Error("WALLET_NOT_FOUND");

    if (wallet.coinsBalance < coinsToReserve) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
    const discountValue       = config.coinRedeemX > 0
      ? parseFloat((coinsToReserve / config.coinRedeemX * config.coinRedeemY).toFixed(2))
      : 0;
    const customerPayableRaw  = agreedPrice - discountValue;
    const customerPayableAmount = parseFloat(Math.max(0, customerPayableRaw).toFixed(2));

    // ── Handle existing reversed redemption row ───────────────────────────────
    //
    // coin_redemptions has a UNIQUE constraint on request_id.  If the customer
    // previously applied coins and then cancelled, a row with status='reversed'
    // already exists.  A fresh INSERT would violate the constraint.
    //
    // Solution: check under the wallet lock whether a reversed row exists for
    // this request.  The wallet lock serialises concurrent calls from the same
    // customer, so only one winner can reach this point at a time.
    //
    //   • reversed row found  → UPDATE it back to active with the new amounts.
    //   • active row found    → someone else already reserved (concurrency guard).
    //   • no row              → INSERT as before.
    const [existingRedemption] = await tx
      .select({
        id:     coinRedemptionsTable.id,
        status: coinRedemptionsTable.status,
      })
      .from(coinRedemptionsTable)
      .where(eq(coinRedemptionsTable.requestId, requestId))
      .limit(1);

    if (existingRedemption) {
      if (existingRedemption.status !== "reversed") {
        // Already active or settled — guard against races / double-submit.
        throw new Error("ALREADY_RESERVED");
      }
      // Re-activate: overwrite the reversed row with the new redemption values.
      await tx
        .update(coinRedemptionsTable)
        .set({
          coinsRedeemed: coinsToReserve,
          discountValue:  String(discountValue),
          status:         "active",
          settledAt:      null,
        })
        .where(
          and(
            eq(coinRedemptionsTable.id,     existingRedemption.id),
            eq(coinRedemptionsTable.status, "reversed"),   // idempotency gate
          )
        );
    } else {
      // No prior redemption for this request — insert fresh.
      await tx.insert(coinRedemptionsTable).values({
        requestId,
        userId,
        coinsRedeemed: coinsToReserve,
        discountValue:  String(discountValue),
        status:         "active",
      });
    }

    const newBalance  = wallet.coinsBalance  - coinsToReserve;
    const newReserved = wallet.reservedCoins + coinsToReserve;

    await tx
      .update(customerWalletsTable)
      .set({ coinsBalance: newBalance, reservedCoins: newReserved, updatedAt: new Date() })
      .where(eq(customerWalletsTable.id, wallet.id));

    await tx.insert(coinTransactionsTable).values({
      walletId:    wallet.id,
      userId,
      amount:      coinsToReserve,
      type:        "redeem",
      description: `حجز ${coinsToReserve} عملة فنشها على الطلب #${requestId} — خصم ${discountValue} جنيه`,
      balanceAfter: newBalance,
      sourceType:  "request",
      sourceId:    requestId,
      requestId,
      performedBy: "customer",
    });

    await tx
      .update(serviceRequestsTable)
      .set({
        customerPayableAmount: String(customerPayableAmount),
        hasDiscount:           true,
        updatedAt:             new Date(),
      })
      .where(eq(serviceRequestsTable.id, requestId));

    return { coinsReserved: coinsToReserve, discountValue, customerPayableAmount };
  });
}

// ─── Coin Release (Phase 4 — DELETE /loyalty/redeem/:requestId) ───────────────

export interface ReleaseCoinsResult {
  coinsReleased: number;
}

/**
 * Reverse an active coin reservation on a service request.
 *
 * Atomic steps:
 *   1. UPDATE coin_redemptions SET status='reversed' WHERE status='active' RETURNING
 *      — idempotency gate; only one concurrent call wins.
 *   2. SELECT wallet FOR UPDATE — serialises with scheduler races.
 *   3. Return coins: reserved ↓, available ↑.
 *   4. Insert "redeem_reversal" coin_transaction.
 *   5. Reset request: customerPayableAmount=agreedPrice, hasDiscount=false.
 *
 * Throws:
 *   "REDEMPTION_NOT_ACTIVE" — no active redemption (already reversed/settled).
 *   "WALLET_NOT_FOUND"     — defensive guard.
 */
export async function releaseReservedCoins(opts: {
  requestId: number;
  agreedPrice: number;
}): Promise<ReleaseCoinsResult> {
  const { requestId, agreedPrice } = opts;

  return await db.transaction(async (tx: Tx) => {
    // ── Atomic claim: active → reversed ─────────────────────────────────────
    const [redemption] = await tx
      .update(coinRedemptionsTable)
      .set({ status: "reversed" })
      .where(
        and(
          eq(coinRedemptionsTable.requestId, requestId),
          eq(coinRedemptionsTable.status,    "active"),
        )
      )
      .returning();

    if (!redemption) throw new Error("REDEMPTION_NOT_ACTIVE");

    // ── Lock wallet — prevents scheduler races ────────────────────────────
    const [wallet] = await tx
      .select()
      .from(customerWalletsTable)
      .where(eq(customerWalletsTable.userId, redemption.userId))
      .for("update")
      .limit(1);

    if (!wallet) throw new Error("WALLET_NOT_FOUND");

    const newBalance  = wallet.coinsBalance  + redemption.coinsRedeemed;
    const newReserved = Math.max(0, wallet.reservedCoins - redemption.coinsRedeemed);

    await tx
      .update(customerWalletsTable)
      .set({ coinsBalance: newBalance, reservedCoins: newReserved, updatedAt: new Date() })
      .where(eq(customerWalletsTable.id, wallet.id));

    await tx.insert(coinTransactionsTable).values({
      walletId:    wallet.id,
      userId:      redemption.userId,
      amount:      redemption.coinsRedeemed,
      type:        "redeem_reversal",
      description: `إعادة ${redemption.coinsRedeemed} عملة فنشها من الطلب #${requestId}`,
      balanceAfter: newBalance,
      sourceType:  "request",
      sourceId:    requestId,
      requestId,
      performedBy: "customer",
    });

    await tx
      .update(serviceRequestsTable)
      .set({
        customerPayableAmount: String(parseFloat(agreedPrice.toFixed(2))),
        hasDiscount:           false,
        updatedAt:             new Date(),
      })
      .where(eq(serviceRequestsTable.id, requestId));

    return { coinsReleased: redemption.coinsRedeemed };
  });
}

// ─── Settle Redemption (used by Phase 6 — requests.ts completion hook) ───────

/**
 * Permanently settle an active coin redemption when its request completes.
 *
 * The coins were already moved out of `coins_balance` into `reserved_coins`
 * (and the `redeem` transaction logged) at reservation time — see
 * `reserveCoins`. On completion we:
 *   1. Atomically claim the redemption: active → settled (idempotency gate;
 *      a second concurrent/duplicate call is a no-op).
 *   2. Lock the wallet, permanently drop the coins from `reserved_coins`,
 *      and add them to `lifetime_used`.
 *   3. Create a `platform_credits` row so the technician is compensated for
 *      the discount gap (agreedPrice − customerPayableAmount).
 *
 * No-ops silently if there is no active redemption for this request.
 */
export async function settleRedemption(requestId: number): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    // ── Atomic claim: active → settled ──────────────────────────────────────
    const [redemption] = await tx
      .update(coinRedemptionsTable)
      .set({ status: "settled", settledAt: new Date() })
      .where(
        and(
          eq(coinRedemptionsTable.requestId, requestId),
          eq(coinRedemptionsTable.status,    "active"),
        )
      )
      .returning();

    if (!redemption) return; // no active redemption — nothing to settle

    // ── Lock wallet — prevents scheduler races ────────────────────────────
    const [wallet] = await tx
      .select()
      .from(customerWalletsTable)
      .where(eq(customerWalletsTable.userId, redemption.userId))
      .for("update")
      .limit(1);

    if (!wallet) throw new Error("WALLET_NOT_FOUND");

    const newReserved     = Math.max(0, wallet.reservedCoins - redemption.coinsRedeemed);
    const newLifetimeUsed = wallet.lifetimeUsed + redemption.coinsRedeemed;

    await tx
      .update(customerWalletsTable)
      .set({ reservedCoins: newReserved, lifetimeUsed: newLifetimeUsed, updatedAt: new Date() })
      .where(eq(customerWalletsTable.id, wallet.id));

    // ── Platform credit — technician is always paid agreedPrice; the
    //    platform covers the discount gap via this record ─────────────────
    const [request] = await tx
      .select({ selectedTechnicianId: serviceRequestsTable.selectedTechnicianId })
      .from(serviceRequestsTable)
      .where(eq(serviceRequestsTable.id, requestId))
      .limit(1);

    if (request?.selectedTechnicianId) {
      await tx.insert(platformCreditsTable).values({
        requestId,
        technicianId: request.selectedTechnicianId,
        amount:       redemption.discountValue,
        status:       "pending_settlement",
      });
    }

    return { technicianId: request?.selectedTechnicianId ?? null, amount: redemption.discountValue };
  }).then(async (result: { technicianId: number | null; amount: unknown } | undefined) => {
    // ── Notify the technician of the new entitlement — independent failure
    //    domain, runs after commit so it never affects the settlement itself.
    if (result?.technicianId) {
      try {
        const { NotificationService } = await import("./notification-service");
        await NotificationService.notifyPlatformCreditAdded(result.technicianId, requestId, Number(result.amount));
      } catch {}
      try {
        const { broadcastToUser } = await import("./sse-broadcast");
        broadcastToUser(result.technicianId, "platform_credit_updated", { requestId, status: "pending_settlement" });
        broadcastToUser(result.technicianId, "new_notification", {});
      } catch {}
    }
  });
}

// ─── Cancel Pending Coins (used by Phase 6 — requests.ts cancel hook) ─────────

/**
 * Cancel any earn_pending coin transactions linked to a request being cancelled.
 * Decrements pending_coins in the wallet and logs a system_cancel transaction.
 * No-ops if no pending coins exist for this request.
 *
 * Concurrency: each txn is claimed atomically via UPDATE-RETURNING before the
 * wallet is locked with FOR UPDATE — safe against concurrent scheduler runs.
 */
export async function cancelPendingCoins(requestId: number): Promise<void> {
  const pendingTxns = await db
    .select()
    .from(coinTransactionsTable)
    .where(
      and(
        eq(coinTransactionsTable.requestId, requestId),
        eq(coinTransactionsTable.type, "earn_pending"),
        eq(coinTransactionsTable.cancelled, false),
      )
    );

  if (pendingTxns.length === 0) return;

  for (const txn of pendingTxns) {
    await db.transaction(async (tx: Tx) => {
      // ── Atomic claim ─────────────────────────────────────────────────────
      const claimed = await tx
        .update(coinTransactionsTable)
        .set({ cancelled: true })
        .where(
          and(
            eq(coinTransactionsTable.id, txn.id),
            eq(coinTransactionsTable.cancelled, false),
          )
        )
        .returning({ id: coinTransactionsTable.id });

      if (claimed.length === 0) return; // already cancelled by concurrent execution

      // ── Lock wallet ───────────────────────────────────────────────────────
      const [wallet] = await tx
        .select()
        .from(customerWalletsTable)
        .where(eq(customerWalletsTable.id, txn.walletId))
        .for("update")
        .limit(1);
      if (!wallet) return;

      const newPending = Math.max(0, wallet.pendingCoins - txn.amount);

      await tx
        .update(customerWalletsTable)
        .set({ pendingCoins: newPending, updatedAt: new Date() })
        .where(eq(customerWalletsTable.id, wallet.id));

      await tx.insert(coinTransactionsTable).values({
        walletId:    wallet.id,
        userId:      txn.userId,
        amount:      txn.amount,
        type:        "system_cancel",
        description: `إلغاء عملات فنشها المعلقة — الطلب #${requestId} تم إلغاؤه`,
        balanceAfter: wallet.coinsBalance,
        sourceType:  "request",
        sourceId:    requestId,
        requestId,
        performedBy: "system",
      });
    });
  }
}

// ─── Referral Reward (used by Phase 6 — requests.ts completion hook) ──────────

/**
 * Trigger referral rewards when a referee completes their first full-price request.
 *
 * Rules:
 *   - The request must have has_discount = false
 *   - The referee must have a pending referrals record
 *   - Rewards are earned immediately (earn_available) — no pending period
 *   - referralEnabled must be true
 *
 * Concurrency: UPDATE-RETURNING on referrals table is the idempotency gate;
 * wallet updates use SELECT ... FOR UPDATE to prevent scheduler races.
 */
/** Result returned when a referral reward was attempted. */
export interface ReferralRewardResult {
  anyRewarded:      boolean;
  referrerId:       number;
  referrerRewarded: boolean;
  refereeRewarded:  boolean;
  referrerCoins:    number;
  refereeCoins:     number;
}

export async function triggerReferralReward(
  refereeUserId: number,
  requestId: number,
  hasDiscount: boolean,
  config: LoyaltyConfig,
): Promise<ReferralRewardResult | false> {
  if (!config.referralEnabled) return false;
  if (hasDiscount) return false;

  return await db.transaction(async (tx: Tx) => {
    // ── Atomic claim ─────────────────────────────────────────────────────────
    const [claimed] = await tx
      .update(referralsTable)
      .set({
        status:         "completed",
        firstRequestId: requestId,
        rewardedAt:     new Date(),
      })
      .where(
        and(
          eq(referralsTable.refereeId, refereeUserId),
          eq(referralsTable.status, "pending"),
        )
      )
      .returning();

    if (!claimed) return false;

    let referrerRewarded = false;
    let refereeRewarded  = false;

    if (config.referralReferrerCoins > 0) {
      referrerRewarded = await _grantReferralCoins(tx, {
        userId:      claimed.referrerId,
        coins:       config.referralReferrerCoins,
        description: `مكافأة الإحالة — الرمز: ${claimed.referralCode}`,
        sourceId:    claimed.id,
      });
    }

    if (config.referralRefereeCoins > 0) {
      refereeRewarded = await _grantReferralCoins(tx, {
        userId:      refereeUserId,
        coins:       config.referralRefereeCoins,
        description: `مكافأة ترحيبية من الإحالة`,
        sourceId:    claimed.id,
      });
    }

    await tx
      .update(referralsTable)
      .set({ referrerRewarded, refereeRewarded })
      .where(eq(referralsTable.id, claimed.id));

    return {
      anyRewarded:      referrerRewarded || refereeRewarded,
      referrerId:       claimed.referrerId,
      referrerRewarded,
      refereeRewarded,
      referrerCoins:    referrerRewarded ? config.referralReferrerCoins : 0,
      refereeCoins:     refereeRewarded  ? config.referralRefereeCoins  : 0,
    };
  });
}

/**
 * Internal: credit referral_bonus coins immediately (earn_available) to a wallet.
 * Runs within the caller's transaction (`tx`).
 * Uses SELECT ... FOR UPDATE to prevent scheduler races on the wallet.
 */
async function _grantReferralCoins(
  tx: Tx,
  opts: { userId: number; coins: number; description: string; sourceId: number },
): Promise<boolean> {
  const { userId, coins, description, sourceId } = opts;

  // Lock wallet — prevents expireAvailableCoins from racing while we're crediting
  const [wallet] = await tx
    .select()
    .from(customerWalletsTable)
    .where(eq(customerWalletsTable.userId, userId))
    .for("update")
    .limit(1);

  if (!wallet) return false;

  const newBalance = wallet.coinsBalance + coins;

  await tx
    .update(customerWalletsTable)
    .set({
      coinsBalance:   newBalance,
      lifetimeEarned: wallet.lifetimeEarned + coins,
      updatedAt:      new Date(),
    })
    .where(eq(customerWalletsTable.id, wallet.id));

  await tx.insert(coinTransactionsTable).values({
    walletId:    wallet.id,
    userId,
    amount:      coins,
    type:        "referral_bonus",
    description,
    balanceAfter: newBalance,
    sourceType:  "referral",
    sourceId,
    performedBy: "system",
  });

  return true;
}

// ─── Phase 10: Pending Coin Maturation Scheduler ──────────────────────────────

export interface SchedulerResult {
  processed: number;
  walletsAffected: number;
}

/**
 * Convert all earn_pending transactions whose expires_at has elapsed into
 * earn_available, crediting the customer's available balance.
 *
 * Called by the loyalty scheduler every 30 minutes.
 *
 * Concurrency model:
 *   1. UPDATE-RETURNING on the earn_pending row (cancelled=false → true) is the
 *      idempotency gate — only one concurrent instance can claim each row.
 *   2. SELECT wallet FOR UPDATE serialises the subsequent wallet update against
 *      concurrent reserveCoins / expireAvailableCoins / cancelPendingCoins calls.
 *
 * If coinExpiryDays > 0 the newly created earn_available transaction is given an
 * expires_at so the expiry scheduler can later pick it up.
 */
export async function maturePendingCoins(): Promise<SchedulerResult> {
  const config = await getLoyaltyConfig();
  const now = new Date();

  // Find all earn_pending transactions ready to mature
  const candidates = await db
    .select()
    .from(coinTransactionsTable)
    .where(
      and(
        eq(coinTransactionsTable.type,      "earn_pending"),
        eq(coinTransactionsTable.cancelled, false),
        sql`${coinTransactionsTable.expiresAt} IS NOT NULL`,
        sql`${coinTransactionsTable.expiresAt} <= NOW()`,
      )
    );

  if (candidates.length === 0) return { processed: 0, walletsAffected: 0 };

  const walletsSet = new Set<number>();
  let processed = 0;

  for (const txn of candidates) {
    try {
      await db.transaction(async (tx: Tx) => {
        // ── Idempotency gate: claim the earn_pending row ─────────────────
        const [claimed] = await tx
          .update(coinTransactionsTable)
          .set({ cancelled: true, maturedAt: now })
          .where(
            and(
              eq(coinTransactionsTable.id,        txn.id),
              eq(coinTransactionsTable.cancelled,  false),
            )
          )
          .returning({ id: coinTransactionsTable.id });

        if (!claimed) return; // concurrent instance already claimed this row

        // ── Lock wallet ───────────────────────────────────────────────────
        const [wallet] = await tx
          .select()
          .from(customerWalletsTable)
          .where(eq(customerWalletsTable.id, txn.walletId))
          .for("update")
          .limit(1);

        if (!wallet) return;

        const newBalance = wallet.coinsBalance + txn.amount;
        const newPending = Math.max(0, wallet.pendingCoins - txn.amount);

        await tx
          .update(customerWalletsTable)
          .set({ coinsBalance: newBalance, pendingCoins: newPending, updatedAt: now })
          .where(eq(customerWalletsTable.id, wallet.id));

        // Assign expiry to the new earn_available if coinExpiryDays is configured
        const earnAvailExpiresAt =
          config.coinExpiryDays > 0
            ? new Date(now.getTime() + config.coinExpiryDays * 24 * 60 * 60 * 1000)
            : undefined;

        await tx.insert(coinTransactionsTable).values({
          walletId:    wallet.id,
          userId:      txn.userId,
          amount:      txn.amount,
          type:        "earn_available",
          description: `عملات فنشها أصبحت متاحة بعد انتهاء فترة الانتظار`,
          balanceAfter: newBalance,
          sourceType:  txn.sourceType ?? "system",
          sourceId:    txn.id,          // points back to originating earn_pending
          requestId:   txn.requestId,
          performedBy: "system",
          ...(earnAvailExpiresAt ? { expiresAt: earnAvailExpiresAt } : {}),
        });

        walletsSet.add(wallet.id);
        processed++;
      });
    } catch (err) {
      console.error(`[LOYALTY SCHEDULER] maturePendingCoins txn=${txn.id} failed:`, (err as Error)?.message);
    }
  }

  return { processed, walletsAffected: walletsSet.size };
}

// ─── Phase 10: Available Coin Expiry Scheduler ────────────────────────────────

/**
 * Expire earn_available transactions whose expires_at has elapsed, deducting
 * the remaining coins from the customer's available balance.
 *
 * Called by the loyalty scheduler every 60 minutes.
 *
 * Concurrency model (same as maturePendingCoins):
 *   1. UPDATE-RETURNING on the earn_available row is the idempotency gate.
 *   2. SELECT wallet FOR UPDATE serialises the balance update.
 *
 * Partial expiry: if the customer already spent some of the coins from this
 * earn_available batch, coinsToExpire = min(txn.amount, wallet.coinsBalance)
 * to avoid going negative. The expiry transaction records the actual amount
 * removed.
 */
export async function expireAvailableCoins(): Promise<SchedulerResult> {
  const now = new Date();

  // Find all earn_available transactions with a lapsed expires_at
  const candidates = await db
    .select()
    .from(coinTransactionsTable)
    .where(
      and(
        eq(coinTransactionsTable.type,      "earn_available"),
        eq(coinTransactionsTable.cancelled, false),
        sql`${coinTransactionsTable.expiresAt} IS NOT NULL`,
        sql`${coinTransactionsTable.expiresAt} <= NOW()`,
      )
    );

  if (candidates.length === 0) return { processed: 0, walletsAffected: 0 };

  const walletsSet = new Set<number>();
  let processed = 0;

  for (const txn of candidates) {
    try {
      await db.transaction(async (tx: Tx) => {
        // ── Idempotency gate: claim the earn_available row ───────────────
        const [claimed] = await tx
          .update(coinTransactionsTable)
          .set({ cancelled: true, expiredAt: now })
          .where(
            and(
              eq(coinTransactionsTable.id,        txn.id),
              eq(coinTransactionsTable.cancelled,  false),
            )
          )
          .returning({ id: coinTransactionsTable.id });

        if (!claimed) return; // concurrent instance already claimed this row

        // ── Lock wallet ───────────────────────────────────────────────────
        const [wallet] = await tx
          .select()
          .from(customerWalletsTable)
          .where(eq(customerWalletsTable.id, txn.walletId))
          .for("update")
          .limit(1);

        if (!wallet) return;

        // Partial expiry guard: never deduct more than the current available balance.
        // Coins may have been partially spent since the earn_available was created.
        const coinsToExpire = Math.min(txn.amount, wallet.coinsBalance);
        if (coinsToExpire <= 0) {
          // All coins already spent — nothing to deduct, but mark the row as
          // processed (cancelled=true is already set) and log a zero-amount expiry.
          await tx.insert(coinTransactionsTable).values({
            walletId:    wallet.id,
            userId:      txn.userId,
            amount:      0,
            type:        "expiry",
            description: `انتهاء صلاحية عملات فنشها (رصيد صفر — تم الإنفاق مسبقاً)`,
            balanceAfter: wallet.coinsBalance,
            sourceType:  "system",
            sourceId:    txn.id,
            requestId:   txn.requestId,
            performedBy: "system",
          });
          walletsSet.add(wallet.id);
          processed++;
          return;
        }

        const newBalance = wallet.coinsBalance - coinsToExpire;

        await tx
          .update(customerWalletsTable)
          .set({ coinsBalance: newBalance, updatedAt: now })
          .where(eq(customerWalletsTable.id, wallet.id));

        await tx.insert(coinTransactionsTable).values({
          walletId:    wallet.id,
          userId:      txn.userId,
          amount:      coinsToExpire,
          type:        "expiry",
          description: `انتهاء صلاحية ${coinsToExpire} عملة فنشها`,
          balanceAfter: newBalance,
          sourceType:  "system",
          sourceId:    txn.id,          // points back to originating earn_available
          requestId:   txn.requestId,
          performedBy: "system",
        });

        walletsSet.add(wallet.id);
        processed++;
      });
    } catch (err) {
      console.error(`[LOYALTY SCHEDULER] expireAvailableCoins txn=${txn.id} failed:`, (err as Error)?.message);
    }
  }

  return { processed, walletsAffected: walletsSet.size };
}
