/**
 * Loyalty Routes — Phase 3 + Phase 4
 *
 * Phase 3: Read-only customer-facing APIs (config, wallet, transactions, referral, calculate)
 * Phase 4: Redemption foundation (POST /redeem, DELETE /redeem/:requestId, enhanced calculate)
 *
 * Routes:
 *   GET    /loyalty/config               — public: consumer-facing loyalty configuration
 *   GET    /loyalty/wallet               — customer: wallet balances + approximate discount
 *   GET    /loyalty/transactions         — customer: paginated coin transaction history
 *   GET    /loyalty/referral-code        — customer: referral code + link + stats
 *   POST   /loyalty/calculate            — customer: coin calculator with customerPayableAmount
 *   POST   /loyalty/redeem               — customer: reserve coins on a request
 *   DELETE /loyalty/redeem/:requestId    — customer: release reserved coins from a request
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  customerWalletsTable,
  coinTransactionsTable,
  coinRedemptionsTable,
  referralsTable,
  serviceRequestsTable,
  usersTable,
  platformCreditsTable,
  campaignsTable,
  campaignDistributionsTable,
  campaignExecutionLogsTable,
  creditSettlementBatchesTable,
  servicesTable,
  governoratesTable,
  areasTable,
} from "@workspace/db";
import { eq, and, desc, count, ilike, or, sql, asc, inArray, isNull, isNotNull, gt, gte, lte } from "drizzle-orm";
import { authenticate, requireRole, requirePermission, logActivity } from "../middlewares/auth";
import {
  getLoyaltyConfig,
  generateReferralCode,
  reserveCoins,
  releaseReservedCoins,
  maturePendingCoins,
  expireAvailableCoins,
} from "../lib/loyaltyEngine";

const router = Router();

const EGYPT_TIME_ZONE = "Africa/Cairo";

/**
 * Admin datetime-local values do not contain an offset. Interpret them as
 * Egypt local time instead of relying on the API process timezone (UTC here).
 * Explicitly offset ISO values remain supported for API callers.
 */
function egyptOffsetMinutes(date: Date): number {
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;

  const match = offsetPart?.match(/^GMT(?:(\+|-)(\d{1,2})(?::?(\d{2}))?)?$/);
  if (!match || !match[1]) return 0;

  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
}

function parseEgyptLocalDateTime(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "0", fraction = "0"] = match;
  const milliseconds = Number(fraction.padEnd(3, "0"));
  const localAsUtc = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds,
  ));
  if (Number.isNaN(localAsUtc.getTime())) return null;

  const initialOffset = egyptOffsetMinutes(localAsUtc);
  let result = new Date(localAsUtc.getTime() - initialOffset * 60_000);
  const correctedOffset = egyptOffsetMinutes(result);
  if (correctedOffset !== initialOffset) {
    result = new Date(localAsUtc.getTime() - correctedOffset * 60_000);
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(result).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const matchesInput =
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute &&
    parts.second === second.padStart(2, "0");

  return matchesInput ? result : null;
}

function registrationRangeDates(
  target: string,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): { startsAt: Date; endsAt: Date } | { error: string } | null {
  if (target !== "registration_range") return null;
  if (!startsAt || !endsAt) {
    return { error: "يجب تحديد تاريخ ووقت بداية ونهاية فترة تسجيل العملاء" };
  }

  const start = parseCampaignDate(startsAt);
  const end = parseCampaignDate(endsAt);
  if (!start || !end) {
    return { error: "صيغة تاريخ ووقت التسجيل غير صالحة" };
  }
  if (start > end) {
    return { error: "يجب أن يكون تاريخ بداية التسجيل قبل أو مساوياً لتاريخ النهاية" };
  }

  return { startsAt: start, endsAt: end };
}

function parseCampaignDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.trim();
  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const parsed = hasExplicitOffset
    ? new Date(normalized)
    : parseEgyptLocalDateTime(normalized);
  return Number.isNaN(parsed?.getTime() ?? NaN) ? null : parsed;
}

function normalizeCampaignNotification(
  titleValue: unknown,
  bodyValue: unknown,
): { notificationTitle: string | null; notificationBody: string | null } | { error: string } {
  const titleProvided = titleValue !== undefined && titleValue !== null;
  const bodyProvided = bodyValue !== undefined && bodyValue !== null;
  if (
    (titleProvided && typeof titleValue !== "string") ||
    (bodyProvided && typeof bodyValue !== "string")
  ) {
    return { error: "عنوان ورسالة إشعار العميل يجب أن يكونا نصاً" };
  }

  if (
    (titleProvided && titleValue.trim() === "") ||
    (bodyProvided && bodyValue.trim() === "")
  ) {
    return { error: "عنوان ورسالة إشعار العميل لا يمكن أن يكونا فارغين أو مسافات فقط" };
  }

  const notificationTitle = typeof titleValue === "string" ? titleValue.trim() : "";
  const notificationBody = typeof bodyValue === "string" ? bodyValue.trim() : "";

  // Both blank means no custom configuration; execution will use the legacy
  // notification so campaigns created before these fields remain executable.
  if (!notificationTitle && !notificationBody) {
    return { notificationTitle: null, notificationBody: null };
  }
  if (!notificationTitle || !notificationBody) {
    return { error: "يجب إدخال عنوان ورسالة إشعار العميل معاً" };
  }
  if (Array.from(notificationTitle).length > 100) {
    return { error: "عنوان إشعار العميل يجب ألا يتجاوز 100 حرف" };
  }
  if (Array.from(notificationBody).length > 500) {
    return { error: "رسالة إشعار العميل يجب ألا تتجاوز 500 حرف" };
  }
  if (/<[^>]*>/i.test(notificationTitle) || /<[^>]*>/i.test(notificationBody)) {
    return { error: "إشعار العميل يقبل نصاً فقط ولا يسمح بوسوم HTML" };
  }

  return { notificationTitle, notificationBody };
}

function parseInactivityDays(segmentFilter: unknown): number | null {
  const rawDays = (segmentFilter as { inactivityDays?: unknown } | null | undefined)?.inactivityDays;
  if (typeof rawDays !== "number" && typeof rawDays !== "string") return null;
  const days = typeof rawDays === "number" ? rawDays : Number(rawDays);
  return Number.isInteger(days) && days >= 1 ? days : null;
}

type ServiceUsage = "used" | "not_used";

function parseServiceBasedFilter(segmentFilter: unknown): { serviceId: number; serviceUsage: ServiceUsage } | null {
  const filter = segmentFilter as { serviceId?: unknown; serviceUsage?: unknown } | null | undefined;
  if (
    (typeof filter?.serviceId !== "number" && typeof filter?.serviceId !== "string")
    || (filter?.serviceUsage !== "used" && filter?.serviceUsage !== "not_used")
  ) {
    return null;
  }
  const serviceId = typeof filter.serviceId === "number" ? filter.serviceId : Number(filter.serviceId);
  if (!Number.isInteger(serviceId) || serviceId < 1) return null;
  return { serviceId, serviceUsage: filter.serviceUsage };
}

type LocationType = "governorate" | "area";
type LocationActivity = "used" | "not_used";

function parseLocationBasedFilter(segmentFilter: unknown): {
  locationType: LocationType;
  governorateId: number;
  areaId?: number;
  activity: LocationActivity;
} | null {
  const filter = segmentFilter as {
    locationType?: unknown;
    governorateId?: unknown;
    areaId?: unknown;
    activity?: unknown;
  } | null | undefined;

  if (
    (filter?.locationType !== "governorate" && filter?.locationType !== "area")
    || (filter?.activity !== "used" && filter?.activity !== "not_used")
  ) {
    return null;
  }

  const governorateId = typeof filter.governorateId === "number"
    ? filter.governorateId
    : Number(filter.governorateId);
  if (!Number.isInteger(governorateId) || governorateId < 1) return null;

  if (filter.locationType === "governorate") {
    return { locationType: filter.locationType, governorateId, activity: filter.activity };
  }

  const areaId = typeof filter.areaId === "number" ? filter.areaId : Number(filter.areaId);
  if (!Number.isInteger(areaId) || areaId < 1) return null;
  return { locationType: filter.locationType, governorateId, areaId, activity: filter.activity };
}

type SpendingPeriod = "all_time" | "custom";

function parseSpendingBasedFilter(segmentFilter: unknown): {
  minimumSpending: number;
  spendingPeriod: SpendingPeriod;
  startsAt?: string;
  endsAt?: string;
} | null {
  const filter = segmentFilter as {
    minimumSpending?: unknown;
    spendingPeriod?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
  } | null | undefined;

  if (
    (typeof filter?.minimumSpending !== "number" && typeof filter?.minimumSpending !== "string")
    || filter.minimumSpending === ""
    || (filter.spendingPeriod !== "all_time" && filter.spendingPeriod !== "custom")
  ) {
    return null;
  }

  const minimumSpending = Number(filter.minimumSpending);
  if (!Number.isFinite(minimumSpending) || minimumSpending <= 0) return null;

  if (filter.spendingPeriod === "all_time") {
    return { minimumSpending, spendingPeriod: "all_time" };
  }

  if (typeof filter.startsAt !== "string" || typeof filter.endsAt !== "string") {
    return null;
  }

  const startsAt = parseCampaignDate(filter.startsAt);
  const endsAt = parseCampaignDate(filter.endsAt);
  if (!startsAt || !endsAt || startsAt > endsAt) return null;

  // Store normalized UTC ISO strings after interpreting offset-less values as
  // Egypt/Cairo local time. Execution can then apply the same instant bounds.
  return {
    minimumSpending,
    spendingPeriod: "custom",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

type CompletedServicesPeriod = "all_time" | "custom";

function parseCompletedServicesFilter(segmentFilter: unknown): {
  minimumCompletedServices: number;
  completedServicesPeriod: CompletedServicesPeriod;
  startsAt?: string;
  endsAt?: string;
} | null {
  const filter = segmentFilter as {
    minimumCompletedServices?: unknown;
    completedServicesPeriod?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
  } | null | undefined;

  if (
    (typeof filter?.minimumCompletedServices !== "number" && typeof filter?.minimumCompletedServices !== "string")
    || filter.minimumCompletedServices === ""
    || (filter.completedServicesPeriod !== "all_time" && filter.completedServicesPeriod !== "custom")
  ) {
    return null;
  }

  const minimumCompletedServices = Number(filter.minimumCompletedServices);
  if (!Number.isInteger(minimumCompletedServices) || minimumCompletedServices < 1) return null;

  if (filter.completedServicesPeriod === "all_time") {
    return { minimumCompletedServices, completedServicesPeriod: "all_time" };
  }

  if (typeof filter.startsAt !== "string" || typeof filter.endsAt !== "string") {
    return null;
  }

  const startsAt = parseCampaignDate(filter.startsAt);
  const endsAt = parseCampaignDate(filter.endsAt);
  if (!startsAt || !endsAt || startsAt > endsAt) return null;

  return {
    minimumCompletedServices,
    completedServicesPeriod: "custom",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function validateCampaignTarget(target: string, segmentFilter: unknown): string | null {
  if (!["all_customers", "manual", "registration_range", "inactive_customers", "service_based", "location_based", "spending_based", "completed_services"].includes(target)) {
    return "نوع الاستهداف غير صالح";
  }
  if (target === "inactive_customers" && parseInactivityDays(segmentFilter) === null) {
    return "يجب تحديد فترة عدم نشاط صحيحة بالأيام";
  }
  if (target === "service_based" && parseServiceBasedFilter(segmentFilter) === null) {
    return "يجب تحديد خدمة ونوع استخدام صحيحين للحملة";
  }
  if (target === "location_based" && parseLocationBasedFilter(segmentFilter) === null) {
    return "يجب تحديد المحافظة أو المنطقة ونوع النشاط الصحيحين للحملة";
  }
  if (target === "spending_based") {
    const filter = parseSpendingBasedFilter(segmentFilter);
    if (filter === null) {
      return "يجب تحديد حد إنفاق صحيح وفترة إنفاق صالحة للحملة";
    }
    if (filter.spendingPeriod === "custom" && filter.startsAt && filter.endsAt) {
      return null;
    }
  }
  if (target === "completed_services" && parseCompletedServicesFilter(segmentFilter) === null) {
    return "يجب تحديد الحد الأدنى للخدمات المكتملة وفترة احتساب صحيحة للحملة";
  }
  return null;
}

async function validateCampaignTargetService(target: string, segmentFilter: unknown): Promise<string | null> {
  const targetError = validateCampaignTarget(target, segmentFilter);
  if (targetError) return targetError;

  if (target === "service_based") {
    const filter = parseServiceBasedFilter(segmentFilter)!;
    const [service] = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(eq(servicesTable.id, filter.serviceId))
      .limit(1);
    return service ? null : "الخدمة المحددة غير موجودة";
  }

  if (target === "location_based") {
    const filter = parseLocationBasedFilter(segmentFilter)!;
    const [governorate] = await db
      .select({ id: governoratesTable.id })
      .from(governoratesTable)
      .where(eq(governoratesTable.id, filter.governorateId))
      .limit(1);
    if (!governorate) return "المحافظة المحددة غير موجودة";

    if (filter.locationType === "area") {
      const [area] = await db
        .select({ id: areasTable.id })
        .from(areasTable)
        .where(and(
          eq(areasTable.id, filter.areaId!),
          eq(areasTable.governorateId, filter.governorateId),
        ))
        .limit(1);
      if (!area) return "المنطقة المحددة غير موجودة أو لا تنتمي إلى المحافظة المختارة";
    }
  }

  return null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Load the wallet row for a customer; returns null if not yet seeded. */
async function getWallet(userId: number) {
  const [wallet] = await db
    .select()
    .from(customerWalletsTable)
    .where(eq(customerWalletsTable.userId, userId))
    .limit(1);
  return wallet ?? null;
}

/** Construct the shareable referral registration link for a customer.
 *
 *  Reads PUBLIC_APP_URL from the environment — the single source of truth for
 *  the application's public base URL.  Set it once per deployment:
 *
 *    Development:  PUBLIC_APP_URL=https://xxxxx.replit.dev
 *    Production:   PUBLIC_APP_URL=https://fnashha.com
 *
 *  No code changes are required when the domain changes.  The value must
 *  NOT have a trailing slash.
 */
function buildReferralLink(referralCode: string): string {
  const base = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    // Fallback: relative URL so the link is always functional even when the
    // env var is missing — the customer can still share and the /r/:code
    // route will resolve correctly from the same origin.
    return `/r/${referralCode}`;
  }
  return `${base}/r/${referralCode}`;
}

// ─── GET /api/loyalty/config ─────────────────────────────────────────────────
//
// Public — no auth required. The customer app needs this to display coin
// program details before the user logs in (landing page, marketing banners, etc.)
//
// Exposes only consumer-facing values. Internal admin-behavior keys
// (allowCoinsPlusCoupons, earnCoinsOnDiscount) are intentionally omitted.

router.get("/loyalty/config", async (_req, res) => {
  try {
    const config = await getLoyaltyConfig();

    return res.json({
      loyaltyEnabled:        config.loyaltyEnabled,
      coinName:              config.coinName,
      coinNameEn:            config.coinNameEn,
      // Earning formula: every coinEarnX EGP = coinEarnY coins
      coinEarnX:             config.coinEarnX,
      coinEarnY:             config.coinEarnY,
      // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
      coinRedeemX:           config.coinRedeemX,
      coinRedeemY:           config.coinRedeemY,
      maxCoinsPerRequest:    config.maxCoinsPerRequest,
      minRequestValue:       config.minRequestValue,
      pendingCoinDays:       config.pendingCoinDays,
      referralEnabled:       config.referralEnabled,
      referralReferrerCoins: config.referralReferrerCoins,
      referralRefereeCoins:  config.referralRefereeCoins,
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/loyalty/wallet ─────────────────────────────────────────────────
//
// Returns the authenticated customer's wallet balances and an approximate
// discount value for the available coins (coins × conversionRatio).

router.get("/loyalty/wallet", authenticate, requireRole("customer"), async (req, res) => {
  try {
    const [config, wallet] = await Promise.all([
      getLoyaltyConfig(),
      getWallet(req.user!.id),
    ]);

    // Wallet is always seeded at registration (Phase 2). Defensive null-guard:
    if (!wallet) {
      return res.json({
        availableCoins:           0,
        pendingCoins:             0,
        reservedCoins:            0,
        lifetimeEarned:           0,
        lifetimeUsed:             0,
        approximateDiscountValue: 0,
        coinName:                 config.coinName,
        coinNameEn:               config.coinNameEn,
        coinRedeemX:              config.coinRedeemX,
        coinRedeemY:              config.coinRedeemY,
      });
    }

    // coinsBalance is the available (spendable) balance; reservedCoins are locked
    // until request completion. Available = coinsBalance (already net of reservations).
    // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
    const approximateDiscountValue = config.coinRedeemX > 0
      ? parseFloat((wallet.coinsBalance / config.coinRedeemX * config.coinRedeemY).toFixed(2))
      : 0;

    // ── Next expiration — FIFO remaining calculation ──────────────────────────
    //
    // The earn_available row stores the *original* batch amount, not the
    // remaining amount.  Coins are consumed FIFO (oldest batch first), so we
    // must walk the batches in expiry-date order and subtract what has already
    // been consumed before we can report how many coins are left in the next-
    // to-expire batch.
    //
    // Total consumed from non-expired batches
    //   = lifetimeUsed  (permanently deducted at request completion)
    //   + reservedCoins (deducted from coinsBalance, pending settlement)
    //
    // (Expired coins are claimed by the scheduler and removed from coinsBalance
    //  with their own "expiry" debit transaction; they don't count here.)

    const expiringBatches = await db
      .select({
        amount:    coinTransactionsTable.amount,
        expiresAt: coinTransactionsTable.expiresAt,
      })
      .from(coinTransactionsTable)
      .where(and(
        eq(coinTransactionsTable.walletId, wallet.id),
        eq(coinTransactionsTable.type, "earn_available"),
        isNotNull(coinTransactionsTable.expiresAt),
        isNull(coinTransactionsTable.expiredAt),   // expiredAt IS NULL ⟹ not yet expired
        gt(coinTransactionsTable.expiresAt, new Date()),
      ))
      .orderBy(asc(coinTransactionsTable.expiresAt));  // oldest-expiring first (FIFO order)

    // ── How many coins from the non-expired batches have already been spent? ──
    //
    // We CANNOT use `wallet.lifetimeUsed` here because that counter includes
    // coins redeemed from batches that have since *expired*.  Those expired
    // batches are excluded from `expiringBatches`, so using lifetimeUsed would
    // over-subtract from the still-active batches and incorrectly return null.
    //
    // Instead, derive consumed purely from the live wallet columns:
    //
    //   total_in_active_batches = SUM of all non-expired earn_available amounts
    //   remaining               = coinsBalance + reservedCoins
    //     (coinsBalance is already net of reservations; adding reservedCoins
    //      gives the total coins still "in flight" for active batches)
    //   consumed_from_active    = total_in_active_batches - remaining
    //
    // Any negative result means earned > spent (no coins consumed yet from
    // active batches), so clamp to 0.

    const sumNonExpired = expiringBatches.reduce(
      (acc, b) => acc + Math.round(parseFloat(String(b.amount))),
      0,
    );
    const remaining = wallet.coinsBalance + wallet.reservedCoins;
    let consumed = Math.max(0, sumNonExpired - remaining);

    let nextExpiration: { amount: number; expiresAt: Date } | null = null;

    for (const batch of expiringBatches) {
      const batchTotal = Math.round(parseFloat(String(batch.amount)));
      if (consumed >= batchTotal) {
        // This entire batch has already been consumed — move to the next one.
        consumed -= batchTotal;
      } else {
        // This batch has remaining coins; it is the next to expire.
        nextExpiration = {
          amount:    batchTotal - consumed,
          expiresAt: batch.expiresAt!,
        };
        break;
      }
    }

    return res.json({
      availableCoins:           wallet.coinsBalance,
      pendingCoins:             wallet.pendingCoins,
      reservedCoins:            wallet.reservedCoins,
      lifetimeEarned:           wallet.lifetimeEarned,
      lifetimeUsed:             wallet.lifetimeUsed,
      approximateDiscountValue,
      coinName:                 config.coinName,
      coinNameEn:               config.coinNameEn,
      coinRedeemX:              config.coinRedeemX,
      coinRedeemY:              config.coinRedeemY,
      nextExpiration,
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/loyalty/transactions ───────────────────────────────────────────
//
// Paginated transaction history for the authenticated customer, newest first.
// Query params: page (default 1), limit (default 20, max 100).

router.get("/loyalty/transactions", authenticate, requireRole("customer"), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt((req.query.page  as string) || "1")  || 1);
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20") || 20));
    const offset = (page - 1) * limit;

    const wallet = await getWallet(req.user!.id);
    if (!wallet) {
      return res.json({ transactions: [], total: 0, page, totalPages: 0 });
    }

    const [transactions, countResult] = await Promise.all([
      db
        .select({
          id:          coinTransactionsTable.id,
          amount:      coinTransactionsTable.amount,
          type:        coinTransactionsTable.type,
          description: coinTransactionsTable.description,
          sourceType:  coinTransactionsTable.sourceType,
          sourceId:    coinTransactionsTable.sourceId,
          balanceAfter: coinTransactionsTable.balanceAfter,
          expiresAt:   coinTransactionsTable.expiresAt,
          cancelled:   coinTransactionsTable.cancelled,
          createdAt:   coinTransactionsTable.createdAt,
        })
        .from(coinTransactionsTable)
        .where(eq(coinTransactionsTable.walletId, wallet.id))
        .orderBy(desc(coinTransactionsTable.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: count() })
        .from(coinTransactionsTable)
        .where(eq(coinTransactionsTable.walletId, wallet.id)),
    ]);

    const total      = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    return res.json({ transactions, total, page, totalPages });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/loyalty/referral-code ──────────────────────────────────────────
//
// Returns the customer's own referral code, a shareable link, and referral
// statistics (pending / completed / total referred users).

router.get("/loyalty/referral-code", authenticate, requireRole("customer"), async (req, res) => {
  try {
    const refereeAlias = db
      .select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .as("referee_referral_u");

    const [userRow, pendingResult, completedResult, rejectedResult, rewardHistory, rewardEarnedResult] = await Promise.all([
      db
        .select({ referralCode: usersTable.referralCode })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.id))
        .limit(1),

      db
        .select({ total: count() })
        .from(referralsTable)
        .where(and(
          eq(referralsTable.referrerId, req.user!.id),
          eq(referralsTable.status, "pending"),
        )),

      db
        .select({ total: count() })
        .from(referralsTable)
        .where(and(
          eq(referralsTable.referrerId, req.user!.id),
          eq(referralsTable.status, "completed"),
        )),

      // fraud_flagged = effectively rejected referrals
      db
        .select({ total: count() })
        .from(referralsTable)
        .where(and(
          eq(referralsTable.referrerId, req.user!.id),
          eq(referralsTable.status, "fraud_flagged"),
        )),

      // Full referral list with referee name for reward history
      db
        .select({
          id:               referralsTable.id,
          refereeName:      refereeAlias.fullName,
          status:           referralsTable.status,
          referrerRewarded: referralsTable.referrerRewarded,
          rewardedAt:       referralsTable.rewardedAt,
          createdAt:        referralsTable.createdAt,
        })
        .from(referralsTable)
        .leftJoin(refereeAlias, eq(referralsTable.refereeId, refereeAlias.id))
        .where(eq(referralsTable.referrerId, req.user!.id))
        .orderBy(desc(referralsTable.createdAt))
        .limit(50),

      // Total coins earned specifically from referral source
      db
        .select({ total: sql<string>`coalesce(sum(${coinTransactionsTable.amount}), '0')` })
        .from(coinTransactionsTable)
        .innerJoin(customerWalletsTable, eq(coinTransactionsTable.walletId, customerWalletsTable.id))
        .where(and(
          eq(customerWalletsTable.userId, req.user!.id),
          eq(coinTransactionsTable.sourceType, "referral"),
        )),
    ]);

    let referralCode = userRow[0]?.referralCode ?? null;

    // Auto-heal: existing accounts created before the referral system was added
    // have referral_code = NULL. Generate and persist a code on first access so
    // no manual DB intervention is ever required.
    //
    // Race safety: the UPDATE is gated on IS NULL so two concurrent requests for
    // the same user can never overwrite an already-persisted code. Whichever
    // write lands second is a no-op (affected rows = 0). After writing we
    // re-read from the DB to return whichever code actually won.
    if (!referralCode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const candidate = await generateReferralCode();
          await db
            .update(usersTable)
            .set({ referralCode: candidate })
            .where(and(eq(usersTable.id, req.user!.id), isNull(usersTable.referralCode)));

          // Re-read to get the winner (could be `candidate` or the concurrent winner).
          const [refreshed] = await db
            .select({ referralCode: usersTable.referralCode })
            .from(usersTable)
            .where(eq(usersTable.id, req.user!.id))
            .limit(1);
          referralCode = refreshed?.referralCode ?? null;
          break;
        } catch {
          // Unique-constraint collision on the generated code: retry with a new one.
          // Any other error: stop and return null — client will retry next load.
          if (attempt === 4) break;
        }
      }
    }

    const referralLink = referralCode ? buildReferralLink(referralCode) : null;

    const pending            = Number(pendingResult[0]?.total  ?? 0);
    const completed          = Number(completedResult[0]?.total ?? 0);
    const rejected           = Number(rejectedResult[0]?.total  ?? 0);
    const totalRewardsEarned = Math.round(parseFloat(rewardEarnedResult[0]?.total ?? "0"));

    return res.json({
      referralCode,
      referralLink,
      statistics: {
        pending,
        completed,
        rejected,
        total: pending + completed + rejected,
        totalRewardsEarned,
      },
      rewardHistory: rewardHistory.map((r) => ({
        id:               r.id,
        refereeName:      r.refereeName ?? "مستخدم",
        status:           r.status,
        referrerRewarded: r.referrerRewarded,
        rewardedAt:       r.rewardedAt,
        createdAt:        r.createdAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/loyalty/calculate ─────────────────────────────────────────────
//
// Phase 4 update: renamed coinsRequested/effectiveCoins → requestedCoins/allowedCoins
// and added customerPayableAmount (present when requestId is supplied).
//
// Calculation only — zero database writes.
//
// Body:
//   coinsToUse  number   (required) — coins the customer wants to spend
//   requestId   number   (optional) — caps by agreedPrice; adds customerPayableAmount

router.post("/loyalty/calculate", authenticate, requireRole("customer"), async (req, res) => {
  try {
    // ── Strict input validation ───────────────────────────────────────────────
    const rawCoins     = req.body?.coinsToUse;
    const rawRequestId = req.body?.requestId;

    if (rawCoins === undefined || rawCoins === null || rawCoins === "") {
      return res.status(400).json({ error: "coinsToUse مطلوب" });
    }
    const coinsToUse = Number(rawCoins);
    if (!Number.isInteger(coinsToUse) || coinsToUse < 0) {
      return res.status(400).json({ error: "coinsToUse يجب أن يكون عدداً صحيحاً غير سالب" });
    }

    let requestId: number | null = null;
    if (rawRequestId !== undefined && rawRequestId !== null && rawRequestId !== "") {
      const parsed = Number(rawRequestId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ error: "requestId يجب أن يكون رقماً صحيحاً موجباً" });
      }
      requestId = parsed;
    }

    const [config, wallet] = await Promise.all([
      getLoyaltyConfig(),
      getWallet(req.user!.id),
    ]);

    const availableBalance = wallet?.coinsBalance ?? 0;

    // ── Caps ──────────────────────────────────────────────────────────────────
    //   Policy cap  : config.maxCoinsPerRequest
    //   Balance cap : customer's available coins
    //   Price cap   : floor(agreedPrice / ratio) — only when requestId provided;
    //                 cap=0 when agreedPrice is null/0 (no coins usable yet)
    const maxFromPolicy              = config.maxCoinsPerRequest;
    let   maxFromRequest: number | null = null;
    let   agreedPriceNum             = 0;

    if (requestId !== null) {
      const [requestRow] = await db
        .select({ agreedPrice: serviceRequestsTable.agreedPrice, customerId: serviceRequestsTable.customerId })
        .from(serviceRequestsTable)
        .where(eq(serviceRequestsTable.id, requestId))
        .limit(1);

      if (!requestRow) return res.status(404).json({ error: "الطلب غير موجود" });
      if (requestRow.customerId !== req.user!.id) return res.status(403).json({ error: "غير مسموح" });

      agreedPriceNum = requestRow.agreedPrice ? parseFloat(String(requestRow.agreedPrice)) : 0;
      // Max coins from price: agreedPrice / coinRedeemY * coinRedeemX
      maxFromRequest =
        agreedPriceNum > 0 && config.coinRedeemY > 0
          ? Math.floor(agreedPriceNum / config.coinRedeemY * config.coinRedeemX)
          : 0;
    }

    const candidates     = [maxFromPolicy, availableBalance, ...(maxFromRequest !== null ? [maxFromRequest] : [])];
    const maxUsableCoins = Math.max(0, Math.min(...candidates));
    const allowedCoins   = Math.min(coinsToUse, maxUsableCoins);
    // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
    const discountValue  = config.coinRedeemX > 0
      ? parseFloat((allowedCoins / config.coinRedeemX * config.coinRedeemY).toFixed(2))
      : 0;
    const remainingCoins = availableBalance - allowedCoins;

    // customerPayableAmount: only meaningful when we know the request price
    const customerPayableAmount =
      requestId !== null && agreedPriceNum > 0
        ? parseFloat(Math.max(0, agreedPriceNum - discountValue).toFixed(2))
        : null;

    return res.json({
      requestedCoins:       coinsToUse,
      allowedCoins,
      discountValue,
      customerPayableAmount,
      maxUsableCoins,
      remainingCoins,
      availableBalance,
      coinRedeemX:          config.coinRedeemX,
      coinRedeemY:          config.coinRedeemY,
      coinName:             config.coinName,
      coinNameEn:           config.coinNameEn,
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/loyalty/redeem ─────────────────────────────────────────────────
//
// Reserve Fnashha Coins against a service request. Coins are NOT permanently
// deducted here — they are moved from available → reserved. Permanent deduction
// (and platform credit creation) happens in Phase 6 at request completion.
//
// Business rules enforced:
//   • loyalty must be enabled
//   • customer must own the request
//   • technician must already be selected (selectedTechnicianId not null)
//   • agreedPrice must exist
//   • agreedPrice ≥ config.minRequestValue
//   • no existing discount on the request (coins + coupon forbidden)
//   • wallet must have enough available coins
//   • coin count capped at config.maxCoinsPerRequest
//   • coin count capped by floor(agreedPrice / conversionRatio)
//
// Body: { requestId: number, coinsToUse: number }

router.post("/loyalty/redeem", authenticate, requireRole("customer"), async (req, res) => {
  try {
    // ── Input validation ──────────────────────────────────────────────────────
    const rawRequestId = req.body?.requestId;
    const rawCoins     = req.body?.coinsToUse;

    if (rawRequestId === undefined || rawRequestId === null || rawRequestId === "") {
      return res.status(400).json({ error: "requestId مطلوب" });
    }
    const requestId = Number(rawRequestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: "requestId يجب أن يكون رقماً صحيحاً موجباً" });
    }

    if (rawCoins === undefined || rawCoins === null || rawCoins === "") {
      return res.status(400).json({ error: "coinsToUse مطلوب" });
    }
    const coinsToUse = Number(rawCoins);
    if (!Number.isInteger(coinsToUse) || coinsToUse <= 0) {
      return res.status(400).json({ error: "coinsToUse يجب أن يكون عدداً صحيحاً موجباً" });
    }

    // ── Load config + request + wallet in parallel ────────────────────────────
    const [config, requestRow, wallet] = await Promise.all([
      getLoyaltyConfig(),
      db.select({
        customerId:           serviceRequestsTable.customerId,
        selectedTechnicianId: serviceRequestsTable.selectedTechnicianId,
        agreedPrice:          serviceRequestsTable.agreedPrice,
        hasDiscount:          serviceRequestsTable.hasDiscount,
      }).from(serviceRequestsTable).where(eq(serviceRequestsTable.id, requestId)).limit(1),
      getWallet(req.user!.id),
    ]);

    // ── Policy gate ───────────────────────────────────────────────────────────
    if (!config.loyaltyEnabled) {
      return res.status(403).json({ error: "عملات فنشها غير مفعّلة حالياً" });
    }

    // ── Request-level validations ─────────────────────────────────────────────
    const request = requestRow[0];
    if (!request) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }
    if (request.customerId !== req.user!.id) {
      return res.status(403).json({ error: "لا يمكنك الوصول إلى هذا الطلب" });
    }
    if (!request.selectedTechnicianId) {
      return res.status(409).json({ error: "يجب اختيار فني قبل استخدام عملات فنشها" });
    }
    if (!request.agreedPrice) {
      return res.status(409).json({ error: "يجب الاتفاق على السعر قبل استخدام عملات فنشها" });
    }

    const agreedPrice = parseFloat(String(request.agreedPrice));

    if (agreedPrice < config.minRequestValue) {
      return res.status(409).json({
        error: `قيمة الطلب أقل من الحد الأدنى للاستبدال (${config.minRequestValue} جنيه)`,
      });
    }

    // ── Discount conflict check (coins + coupons forbidden) ───────────────────
    if (request.hasDiscount) {
      // Check whether the existing discount is an active coin redemption
      // (customer trying to re-redeem) or some other discount (coupon, promo).
      const [existingRedemption] = await db
        .select({ id: coinRedemptionsTable.id, status: coinRedemptionsTable.status })
        .from(coinRedemptionsTable)
        .where(
          and(
            eq(coinRedemptionsTable.requestId, requestId),
            eq(coinRedemptionsTable.status, "active"),
          )
        )
        .limit(1);

      if (existingRedemption) {
        return res.status(409).json({ error: "عملات فنشها محجوزة بالفعل لهذا الطلب" });
      }
      // has_discount=true but no active coin redemption → another discount type
      return res.status(409).json({ error: "يوجد خصم آخر مُطبَّق على هذا الطلب — لا يمكن الجمع بين عملات فنشها والخصومات الأخرى" });
    }

    // ── Wallet validations ────────────────────────────────────────────────────
    if (!wallet) {
      return res.status(409).json({ error: "لا توجد محفظة عملات فنشها لهذا الحساب" });
    }

    // ── Cap calculation (same logic as calculate endpoint) ────────────────────
    // Max coins = agreedPrice / coinRedeemY * coinRedeemX
    const maxFromPrice  = config.coinRedeemY > 0
      ? Math.floor(agreedPrice / config.coinRedeemY * config.coinRedeemX)
      : 0;
    const maxUsable = Math.max(0, Math.min(
      config.maxCoinsPerRequest,
      wallet.coinsBalance,
      maxFromPrice,
    ));

    if (wallet.coinsBalance < coinsToUse) {
      return res.status(409).json({ error: "رصيدك من عملات فنشها غير كافٍ" });
    }
    if (coinsToUse > config.maxCoinsPerRequest) {
      return res.status(409).json({
        error: `لا يمكن استخدام أكثر من ${config.maxCoinsPerRequest} عملة في طلب واحد`,
      });
    }

    // Cap the actual coins to the price ceiling (customer may request more than the price covers)
    const coinsToReserve = Math.min(coinsToUse, maxFromPrice);
    if (coinsToReserve <= 0) {
      return res.status(409).json({ error: "لا يمكن استخدام عملات فنشها على هذا الطلب" });
    }

    // ── Atomic reservation (engine handles wallet + redemption + request update) ─
    const result = await reserveCoins({
      userId:         req.user!.id,
      requestId,
      coinsToReserve,
      agreedPrice,
      config,
    });

    return res.status(201).json({
      message:              "تم حجز عملات فنشها بنجاح",
      coinsReserved:        result.coinsReserved,
      discountValue:        result.discountValue,
      customerPayableAmount: result.customerPayableAmount,
      maxUsableCoins:       maxUsable,
      coinName:             config.coinName,
      coinNameEn:           config.coinNameEn,
    });
  } catch (err: unknown) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "INSUFFICIENT_BALANCE") {
        return res.status(409).json({ error: "رصيدك من عملات فنشها غير كافٍ" });
      }
      if (msg === "ALREADY_RESERVED") {
        return res.status(409).json({ error: "عملات فنشها محجوزة بالفعل لهذا الطلب" });
      }
      // Fallback: unique-constraint violation surfaced directly by the DB driver
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return res.status(409).json({ error: "عملات فنشها محجوزة بالفعل لهذا الطلب" });
      }
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── DELETE /api/loyalty/redeem/:requestId ────────────────────────────────────
//
// Release (reverse) a coin reservation from a service request. Returns the
// reserved coins to the customer's available balance and resets the request's
// discount fields.
//
// Allowed only while the redemption is still "active" (not settled/reversed).
// Settlement happens in Phase 6 at request completion.

router.delete("/loyalty/redeem/:requestId", authenticate, requireRole("customer"), async (req, res) => {
  try {
    // ── Param validation ──────────────────────────────────────────────────────
    const requestId = Number(req.params.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: "requestId غير صالح" });
    }

    // ── Load request (ownership + agreedPrice) ────────────────────────────────
    const [request] = await db
      .select({
        customerId:  serviceRequestsTable.customerId,
        agreedPrice: serviceRequestsTable.agreedPrice,
      })
      .from(serviceRequestsTable)
      .where(eq(serviceRequestsTable.id, requestId))
      .limit(1);

    if (!request) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }
    if (request.customerId !== req.user!.id) {
      return res.status(403).json({ error: "لا يمكنك الوصول إلى هذا الطلب" });
    }

    const agreedPrice = request.agreedPrice
      ? parseFloat(String(request.agreedPrice))
      : 0;

    // ── Atomic release (engine handles everything) ────────────────────────────
    const result = await releaseReservedCoins({ requestId, agreedPrice });

    return res.json({
      message:       "تم إلغاء حجز عملات فنشها وإعادتها إلى محفظتك",
      coinsReleased: result.coinsReleased,
    });
  } catch (err: unknown) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "REDEMPTION_NOT_ACTIVE") {
        return res.status(409).json({ error: "لا يوجد حجز عملات فنشها نشط لهذا الطلب" });
      }
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LOYALTY MANAGEMENT — Phase 8
// All routes require authenticate + requirePermission("loyalty.view" | "loyalty.manage")
// ═══════════════════════════════════════════════════════════════════════════════

const adminView   = [authenticate, requirePermission("loyalty.view")];
const adminManage = [authenticate, requirePermission("loyalty.manage")];

// ─── GET /loyalty/admin/dashboard ─────────────────────────────────────────────
router.get("/loyalty/admin/dashboard", ...adminView, async (req, res) => {
  try {
    const [walletsRow] = await db
      .select({
        totalWallets:   count(),
        totalAvailable: sql<number>`sum(coins_balance)`,
        totalPending:   sql<number>`sum(pending_coins)`,
        totalReserved:  sql<number>`sum(reserved_coins)`,
        totalLifetime:  sql<number>`sum(lifetime_earned)`,
        totalUsed:      sql<number>`sum(lifetime_used)`,
      })
      .from(customerWalletsTable);

    const [creditsRow] = await db
      .select({
        totalPending: count(),
        totalAmount:  sql<string>`coalesce(sum(amount),0)`,
      })
      .from(platformCreditsTable)
      .where(eq(platformCreditsTable.status, "pending_settlement"));

    const [referralsRow] = await db
      .select({
        totalReferrals:   count(),
        completedCount:   sql<number>`sum(case when status='completed' then 1 else 0 end)`,
        pendingCount:     sql<number>`sum(case when status='pending' then 1 else 0 end)`,
      })
      .from(referralsTable);

    const [campaignsRow] = await db
      .select({ activeCampaigns: sql<number>`sum(case when is_active then 1 else 0 end)`, total: count() })
      .from(campaignsTable);

    const recentTxns = await db
      .select({
        id:          coinTransactionsTable.id,
        amount:      coinTransactionsTable.amount,
        type:        coinTransactionsTable.type,
        description: coinTransactionsTable.description,
        createdAt:   coinTransactionsTable.createdAt,
        userName:    usersTable.fullName,
      })
      .from(coinTransactionsTable)
      .leftJoin(usersTable, eq(coinTransactionsTable.userId, usersTable.id))
      .orderBy(desc(coinTransactionsTable.createdAt))
      .limit(10);

    return res.json({
      wallets: {
        totalWallets:   Number(walletsRow?.totalWallets ?? 0),
        totalAvailable: Number(walletsRow?.totalAvailable ?? 0),
        totalPending:   Number(walletsRow?.totalPending ?? 0),
        totalReserved:  Number(walletsRow?.totalReserved ?? 0),
        totalLifetime:  Number(walletsRow?.totalLifetime ?? 0),
        totalUsed:      Number(walletsRow?.totalUsed ?? 0),
      },
      credits: {
        pendingCount:  Number(creditsRow?.totalPending ?? 0),
        pendingAmount: parseFloat(String(creditsRow?.totalAmount ?? "0")),
      },
      referrals: {
        total:     Number(referralsRow?.totalReferrals ?? 0),
        completed: Number(referralsRow?.completedCount ?? 0),
        pending:   Number(referralsRow?.pendingCount ?? 0),
      },
      campaigns: {
        total:  Number(campaignsRow?.total ?? 0),
        active: Number(campaignsRow?.activeCampaigns ?? 0),
      },
      recentTransactions: recentTxns,
    });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/wallets ───────────────────────────────────────────────
router.get("/loyalty/admin/wallets", ...adminView, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const sort   = String(req.query.sort || "lifetime_earned");
    const dir    = req.query.dir === "asc" ? asc : desc;

    const SORT_COLS: Record<string, any> = {
      lifetime_earned: customerWalletsTable.lifetimeEarned,
      coins_balance:   customerWalletsTable.coinsBalance,
      pending_coins:   customerWalletsTable.pendingCoins,
      lifetime_used:   customerWalletsTable.lifetimeUsed,
      created_at:      customerWalletsTable.createdAt,
    };
    const sortCol = SORT_COLS[sort] ?? customerWalletsTable.lifetimeEarned;

    // Always exclude the Founder from wallet management — defence-in-depth
    const baseConditions: any[] = [eq(usersTable.isFounder, false)];
    if (search) {
      baseConditions.push(or(ilike(usersTable.fullName, `%${search}%`), ilike(usersTable.mobile, `%${search}%`)));
    }
    const conditions = and(...baseConditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(customerWalletsTable)
      .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
      .where(conditions);

    const wallets = await db
      .select({
        id:             customerWalletsTable.id,
        userId:         customerWalletsTable.userId,
        coinsBalance:   customerWalletsTable.coinsBalance,
        pendingCoins:   customerWalletsTable.pendingCoins,
        reservedCoins:  customerWalletsTable.reservedCoins,
        lifetimeEarned: customerWalletsTable.lifetimeEarned,
        lifetimeUsed:   customerWalletsTable.lifetimeUsed,
        createdAt:      customerWalletsTable.createdAt,
        userName:       usersTable.fullName,
        userMobile:     usersTable.mobile,
        userStatus:     usersTable.status,
      })
      .from(customerWalletsTable)
      .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
      .where(conditions)
      .orderBy(dir(sortCol))
      .limit(limit)
      .offset(offset);

    return res.json({ wallets, total: Number(total), page, limit });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/wallets/:userId ───────────────────────────────────────
router.get("/loyalty/admin/wallets/:userId", ...adminView, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId));
    if (isNaN(userId)) return res.status(400).json({ error: "معرف العميل غير صالح" });

    const [user] = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile, status: usersTable.status, referralCode: usersTable.referralCode, isFounder: usersTable.isFounder })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "العميل غير موجود" });
    // Founder is not a customer — block access entirely
    if (user.isFounder) return res.status(404).json({ error: "العميل غير موجود" });

    const [wallet] = await db
      .select()
      .from(customerWalletsTable)
      .where(eq(customerWalletsTable.userId, userId))
      .limit(1);

    const txnPage  = Math.max(1, Number(req.query.page) || 1);
    const txnLimit = 20;
    const txnOffset = (txnPage - 1) * txnLimit;

    const [{ total: txnTotal }] = await db
      .select({ total: count() })
      .from(coinTransactionsTable)
      .where(eq(coinTransactionsTable.userId, userId));

    const transactions = await db
      .select()
      .from(coinTransactionsTable)
      .where(eq(coinTransactionsTable.userId, userId))
      .orderBy(desc(coinTransactionsTable.createdAt))
      .limit(txnLimit)
      .offset(txnOffset);

    return res.json({ user, wallet: wallet ?? null, transactions, txnTotal: Number(txnTotal), txnPage, txnLimit });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── POST /loyalty/admin/wallets/:userId/adjust ───────────────────────────────
router.post("/loyalty/admin/wallets/:userId/adjust", ...adminManage, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId));
    if (isNaN(userId)) return res.status(400).json({ error: "معرف العميل غير صالح" });

    // Block Founder from wallet operations
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "العميل غير موجود" });

    const { type, amount, description } = req.body as { type: "manual_credit" | "manual_debit"; amount: number; description: string };
    if (!["manual_credit", "manual_debit"].includes(type)) return res.status(400).json({ error: "نوع التعديل غير صالح" });
    const coins = parseInt(String(amount));
    if (isNaN(coins) || coins <= 0) return res.status(400).json({ error: "المبلغ يجب أن يكون رقماً موجباً" });
    if (!description?.trim()) return res.status(400).json({ error: "وصف التعديل مطلوب" });

    const result = await db.transaction(async (tx: any) => {
      const [wallet] = await tx
        .select()
        .from(customerWalletsTable)
        .where(eq(customerWalletsTable.userId, userId))
        .for("update")
        .limit(1);
      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      let newBalance: number;
      if (type === "manual_credit") {
        newBalance = wallet.coinsBalance + coins;
        await tx.update(customerWalletsTable)
          .set({ coinsBalance: newBalance, lifetimeEarned: wallet.lifetimeEarned + coins, updatedAt: new Date() })
          .where(eq(customerWalletsTable.id, wallet.id));
      } else {
        if (wallet.coinsBalance < coins) throw new Error("INSUFFICIENT_BALANCE");
        newBalance = wallet.coinsBalance - coins;
        await tx.update(customerWalletsTable)
          .set({ coinsBalance: newBalance, lifetimeUsed: wallet.lifetimeUsed + coins, updatedAt: new Date() })
          .where(eq(customerWalletsTable.id, wallet.id));
      }

      await tx.insert(coinTransactionsTable).values({
        walletId:    wallet.id,
        userId,
        amount:      coins,
        type,
        description: description.trim(),
        balanceAfter: newBalance,
        sourceType:  "manual",
        adminId:     req.user!.id > 0 ? req.user!.id : null,
        performedBy: "admin",
      });

      return { newBalance, coinsAdjusted: coins };
    });

    try {
      await logActivity(req.user!.id, "loyalty_wallet_adjust", `userId=${userId}, type=${type}, coins=${coins}`, req.ip);
    } catch {}

    return res.json({ message: type === "manual_credit" ? "تم إضافة الكوينز بنجاح" : "تم خصم الكوينز بنجاح", ...result });
  } catch (err: unknown) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "WALLET_NOT_FOUND") return res.status(404).json({ error: "المحفظة غير موجودة" });
      if (msg === "INSUFFICIENT_BALANCE") return res.status(400).json({ error: "رصيد الكوينز غير كافٍ للخصم" });
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── GET /loyalty/admin/platform-credits ─────────────────────────────────────
router.get("/loyalty/admin/platform-credits", ...adminView, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const limit    = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const offset   = (page - 1) * limit;
    const status   = req.query.status as string | undefined;

    const conditions = status ? [eq(platformCreditsTable.status, status as any)] : [];

    const [{ total }] = await db
      .select({ total: count() })
      .from(platformCreditsTable)
      .where(conditions.length ? and(...conditions) : undefined);

    const techUsers = db.select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile }).from(usersTable).as("tech_users");

    const credits = await db
      .select({
        id:               platformCreditsTable.id,
        requestId:        platformCreditsTable.requestId,
        technicianId:     platformCreditsTable.technicianId,
        amount:           platformCreditsTable.amount,
        status:           platformCreditsTable.status,
        batchId:          platformCreditsTable.batchId,
        paymentMethod:    platformCreditsTable.paymentMethod,
        paymentDate:      platformCreditsTable.paymentDate,
        paymentReference: platformCreditsTable.paymentReference,
        createdAt:        platformCreditsTable.createdAt,
        updatedAt:        platformCreditsTable.updatedAt,
        techName:         techUsers.fullName,
        techMobile:       techUsers.mobile,
      })
      .from(platformCreditsTable)
      .leftJoin(techUsers, eq(platformCreditsTable.technicianId, techUsers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(platformCreditsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ credits, total: Number(total), page, limit });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── PATCH /loyalty/admin/platform-credits/:id/mark-paid ─────────────────────
router.patch("/loyalty/admin/platform-credits/:id/mark-paid", ...adminManage, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

    const { paymentMethod, paymentReference } = req.body as { paymentMethod?: string; paymentReference?: string };

    const [credit] = await db
      .update(platformCreditsTable)
      .set({
        status:           "paid",
        paymentMethod:    paymentMethod ?? null,
        paymentDate:      new Date(),
        paymentReference: paymentReference ?? null,
        updatedAt:        new Date(),
      })
      .where(and(eq(platformCreditsTable.id, id), eq(platformCreditsTable.status, "pending_settlement")))
      .returning();

    if (!credit) return res.status(404).json({ error: "السجل غير موجود أو تم تسويته مسبقاً" });

    res.json({ message: "تم تحديد الائتمان كمدفوع", credit });

    try {
      await logActivity(req.user!.id, "platform_credit_paid", `creditId=${id}, amount=${credit.amount}`, req.ip);
    } catch {}

    try {
      const { NotificationService } = await import("../lib/notification-service");
      await NotificationService.notifyPlatformCreditPaid(credit.technicianId, credit.requestId, Number(credit.amount));
    } catch {}
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(credit.technicianId, "platform_credit_updated", { requestId: credit.requestId, status: "paid" });
      broadcastToUser(credit.technicianId, "new_notification", {});
      // Notify admins so the pending-credits badge updates without a page refresh
      broadcastAdminEvent("platform_credit_updated", { creditId: id });
    } catch {}
    return;
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── POST /loyalty/admin/platform-credits/settle ─────────────────────────────
// Batch settlement: groups a set of pending_settlement credits (or "all
// pending" when creditIds is omitted) into a credit_settlement_batches
// record, then marks every credit in the batch as paid with the same
// payment details. Matches LOYALTY_SYSTEM_PLAN.md §4.2 / §7.
router.post("/loyalty/admin/platform-credits/settle", ...adminManage, async (req, res) => {
  try {
    const { creditIds, label, paymentMethod, paymentReference, notes } = req.body as {
      creditIds?: number[];
      label?: string;
      paymentMethod?: string;
      paymentReference?: string;
      notes?: string;
    };

    const result = await db.transaction(async (tx) => {
      // ── Atomic claim: pending_settlement → paid, gated on status in the
      // WHERE clause. RETURNING is the authoritative claimed set — this is
      // the same claim-then-act idempotency pattern used by the scheduler
      // (maturePendingCoins/expireAvailableCoins), so two concurrent settle
      // calls (or overlapping id sets) can never claim the same credit twice.
      const claimConditions = [eq(platformCreditsTable.status, "pending_settlement")];
      if (Array.isArray(creditIds) && creditIds.length > 0) {
        claimConditions.push(inArray(platformCreditsTable.id, creditIds));
      }

      const claimed = await tx
        .update(platformCreditsTable)
        .set({
          status:           "paid",
          paymentMethod:    paymentMethod ?? null,
          paymentDate:      new Date(),
          paymentReference: paymentReference ?? null,
          updatedAt:        new Date(),
        })
        .where(and(...claimConditions))
        .returning();

      if (claimed.length === 0) return null;

      const totalAmount = claimed.reduce((sum, c) => sum + parseFloat(c.amount as string), 0);

      const [batch] = await tx
        .insert(creditSettlementBatchesTable)
        .values({
          label:        label || `تسوية ${new Date().toISOString().slice(0, 10)}`,
          totalAmount:  totalAmount.toFixed(2),
          creditCount:  claimed.length,
          createdBy:    req.user!.id === 0 ? null : req.user!.id,
          paidAt:       new Date(),
          notes:        notes ?? null,
        })
        .returning();

      // Link the already-claimed credits to their batch.
      await tx
        .update(platformCreditsTable)
        .set({ batchId: batch.id, updatedAt: new Date() })
        .where(inArray(platformCreditsTable.id, claimed.map((c) => c.id)));

      return { batch, creditCount: claimed.length, totalAmount, claimed };
    });

    if (!result) return res.status(404).json({ error: "لا توجد ائتمانات معلقة للتسوية" });

    const { claimed, ...responseBody } = result;
    res.json({ message: "تم تسوية الائتمانات بنجاح", ...responseBody });

    try {
      await logActivity(req.user!.id, "platform_credits_batch_settled", `batchId=${result.batch.id}, count=${result.creditCount}, total=${result.totalAmount}`, req.ip);
    } catch {}

    // Notify each affected technician — independent failure domain, non-blocking.
    try {
      const { NotificationService } = await import("../lib/notification-service");
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      await Promise.all(
        claimed.map(async (c) => {
          try {
            await NotificationService.notifyPlatformCreditPaid(c.technicianId, c.requestId, parseFloat(c.amount as string));
          } catch {}
          try {
            broadcastToUser(c.technicianId, "platform_credit_updated", { requestId: c.requestId, status: "paid" });
            broadcastToUser(c.technicianId, "new_notification", {});
          } catch {}
        })
      );
      // Notify admins so the pending-credits badge updates without a page refresh
      try { broadcastAdminEvent("platform_credit_updated", { batchId: result.batch.id }); } catch {}
    } catch {}
    return;
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/referrals ─────────────────────────────────────────────
router.get("/loyalty/admin/referrals", ...adminView, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const conditions = status ? [eq(referralsTable.status, status as any)] : [];

    const [{ total }] = await db
      .select({ total: count() })
      .from(referralsTable)
      .where(conditions.length ? and(...conditions) : undefined);

    const referrerAlias = db.select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile }).from(usersTable).as("referrer_u");
    const refereeAlias  = db.select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile }).from(usersTable).as("referee_u");

    const referrals = await db
      .select({
        id:               referralsTable.id,
        referrerId:       referralsTable.referrerId,
        refereeId:        referralsTable.refereeId,
        referralCode:     referralsTable.referralCode,
        status:           referralsTable.status,
        referrerRewarded: referralsTable.referrerRewarded,
        refereeRewarded:  referralsTable.refereeRewarded,
        firstRequestId:   referralsTable.firstRequestId,
        createdAt:        referralsTable.createdAt,
        rewardedAt:       referralsTable.rewardedAt,
        referrerName:     referrerAlias.fullName,
        referrerMobile:   referrerAlias.mobile,
        refereeName:      refereeAlias.fullName,
        refereeMobile:    refereeAlias.mobile,
      })
      .from(referralsTable)
      .leftJoin(referrerAlias, eq(referralsTable.referrerId, referrerAlias.id))
      .leftJoin(refereeAlias,  eq(referralsTable.refereeId,  refereeAlias.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(referralsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ referrals, total: Number(total), page, limit });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/campaigns ─────────────────────────────────────────────
router.get("/loyalty/admin/campaigns", ...adminView, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [{ total }] = await db.select({ total: count() }).from(campaignsTable);

    const creatorAlias = db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).as("creator_u");

    const campaigns = await db
      .select({
        id:             campaignsTable.id,
        name:           campaignsTable.name,
        nameAr:         campaignsTable.nameAr,
        description:    campaignsTable.description,
        notificationTitle: campaignsTable.notificationTitle,
        notificationBody:  campaignsTable.notificationBody,
        coinsAmount:    campaignsTable.coinsAmount,
        target:         campaignsTable.target,
        segmentFilter:  campaignsTable.segmentFilter,
        isActive:       campaignsTable.isActive,
        startsAt:       campaignsTable.startsAt,
        endsAt:         campaignsTable.endsAt,
        createdAt:      campaignsTable.createdAt,
        createdBy:      campaignsTable.createdBy,
        creatorName:    creatorAlias.fullName,
      })
      .from(campaignsTable)
      .leftJoin(creatorAlias, eq(campaignsTable.createdBy, creatorAlias.id))
      .orderBy(desc(campaignsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ campaigns, total: Number(total), page, limit });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── POST /loyalty/admin/campaigns ────────────────────────────────────────────
router.post("/loyalty/admin/campaigns", ...adminManage, async (req, res) => {
  try {
    const { name, nameAr, description, notificationTitle, notificationBody, coinsAmount, target, segmentFilter, isActive, startsAt, endsAt } =
      req.body as { name: string; nameAr: string; description?: string; notificationTitle?: unknown; notificationBody?: unknown; coinsAmount: number; target: string; segmentFilter?: any; isActive?: boolean; startsAt?: string; endsAt?: string };

    if (!name?.trim() || !nameAr?.trim()) return res.status(400).json({ error: "الاسم بالعربي والإنجليزي مطلوبان" });
    const notification = normalizeCampaignNotification(notificationTitle, notificationBody);
    if ("error" in notification) {
      return res.status(400).json({ error: notification.error });
    }
    const coins = parseInt(String(coinsAmount));
    if (isNaN(coins) || coins <= 0) return res.status(400).json({ error: "عدد الكوينز يجب أن يكون رقماً موجباً" });
    const targetError = await validateCampaignTargetService(target, segmentFilter);
    if (targetError) {
      return res.status(400).json({ error: targetError });
    }

    const registrationDates = registrationRangeDates(target, startsAt, endsAt);
    if (registrationDates && "error" in registrationDates) {
      return res.status(400).json({ error: registrationDates.error });
    }

    const createdBy = req.user!.id > 0 ? req.user!.id : null;

    const normalizedSegmentFilter = target === "service_based"
      ? parseServiceBasedFilter(segmentFilter)
      : target === "spending_based"
        ? parseSpendingBasedFilter(segmentFilter)
        : target === "completed_services"
          ? parseCompletedServicesFilter(segmentFilter)
        : segmentFilter;

    const [campaign] = await db.insert(campaignsTable).values({
      name:        name.trim(),
      nameAr:      nameAr.trim(),
      description: description?.trim() || null,
      notificationTitle: notification.notificationTitle,
      notificationBody:  notification.notificationBody,
      coinsAmount: coins,
      target:      target as any,
      segmentFilter: normalizedSegmentFilter ?? null,
      isActive:    !!isActive,
      createdBy,
      startsAt:    registrationDates ? registrationDates.startsAt : (startsAt ? new Date(startsAt) : null),
      endsAt:      registrationDates ? registrationDates.endsAt : (endsAt ? new Date(endsAt) : null),
    }).returning();

    try {
      await logActivity(req.user!.id, "campaign_created", `campaignId=${campaign.id}, name=${name}`, req.ip);
    } catch {}

    return res.status(201).json({ message: "تم إنشاء الحملة بنجاح", campaign });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── PUT /loyalty/admin/campaigns/:id ─────────────────────────────────────────
router.put("/loyalty/admin/campaigns/:id", ...adminManage, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

    const { name, nameAr, description, notificationTitle, notificationBody, coinsAmount, target, segmentFilter, isActive, startsAt, endsAt } =
      req.body as { name?: string; nameAr?: string; description?: string; notificationTitle?: unknown; notificationBody?: unknown; coinsAmount?: number; target?: string; segmentFilter?: any; isActive?: boolean; startsAt?: string | null; endsAt?: string | null };

    const [existingCampaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id))
      .limit(1);
    if (!existingCampaign) return res.status(404).json({ error: "الحملة غير موجودة" });

    const notification = normalizeCampaignNotification(
      notificationTitle !== undefined ? notificationTitle : existingCampaign.notificationTitle,
      notificationBody !== undefined ? notificationBody : existingCampaign.notificationBody,
    );
    if ("error" in notification) {
      return res.status(400).json({ error: notification.error });
    }

    const nextTarget = target ?? existingCampaign.target;
    const nextSegmentFilter = segmentFilter !== undefined
      ? segmentFilter
      : existingCampaign.segmentFilter;
    const targetError = await validateCampaignTargetService(nextTarget, nextSegmentFilter);
    if (targetError) {
      return res.status(400).json({ error: targetError });
    }

    const registrationDates = registrationRangeDates(
      nextTarget,
      startsAt !== undefined ? startsAt : existingCampaign.startsAt?.toISOString(),
      endsAt !== undefined ? endsAt : existingCampaign.endsAt?.toISOString(),
    );
    if (registrationDates && "error" in registrationDates) {
      return res.status(400).json({ error: registrationDates.error });
    }

    const updates: Record<string, any> = {};
    if (name     !== undefined) updates.name        = name.trim();
    if (nameAr   !== undefined) updates.nameAr      = nameAr.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (notificationTitle !== undefined || notificationBody !== undefined) {
      updates.notificationTitle = notification.notificationTitle;
      updates.notificationBody = notification.notificationBody;
    }
    if (coinsAmount !== undefined) {
      const coins = parseInt(String(coinsAmount));
      if (isNaN(coins) || coins <= 0) return res.status(400).json({ error: "عدد الكوينز يجب أن يكون رقماً موجباً" });
      updates.coinsAmount = coins;
    }
    if (target   !== undefined) {
      updates.target = target;
    }
    if (segmentFilter !== undefined) {
      updates.segmentFilter = nextTarget === "service_based"
        ? parseServiceBasedFilter(segmentFilter)
        : nextTarget === "spending_based"
          ? parseSpendingBasedFilter(segmentFilter)
        : nextTarget === "completed_services"
          ? parseCompletedServicesFilter(segmentFilter)
        : segmentFilter;
    }
    if (isActive !== undefined) updates.isActive = !!isActive;
    if (startsAt !== undefined) {
      updates.startsAt = registrationDates && !("error" in registrationDates)
        ? registrationDates.startsAt
        : (startsAt ? new Date(startsAt) : null);
    }
    if (endsAt !== undefined) {
      updates.endsAt = registrationDates && !("error" in registrationDates)
        ? registrationDates.endsAt
        : (endsAt ? new Date(endsAt) : null);
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "لا توجد تغييرات للحفظ" });

    const [campaign] = await db.update(campaignsTable).set(updates).where(eq(campaignsTable.id, id)).returning();
    if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });

    try {
      await logActivity(req.user!.id, "campaign_updated", `campaignId=${id}`, req.ip);
    } catch {}

    return res.json({ message: "تم تحديث الحملة بنجاح", campaign });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── DELETE /loyalty/admin/campaigns/:id ──────────────────────────────────────
router.delete("/loyalty/admin/campaigns/:id", ...adminManage, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

    const [deleted] = await db.delete(campaignsTable).where(eq(campaignsTable.id, id)).returning({ id: campaignsTable.id });
    if (!deleted) return res.status(404).json({ error: "الحملة غير موجودة" });

    try {
      await logActivity(req.user!.id, "campaign_deleted", `campaignId=${id}`, req.ip);
    } catch {}

    return res.json({ message: "تم حذف الحملة بنجاح" });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── POST /loyalty/admin/campaigns/:id/execute ────────────────────────────────
// Distribute campaign coins to all matching customers.
// Duplicate-safe: campaign_distributions has UNIQUE(campaign_id, wallet_id).
// Everything runs inside a single db.transaction() so wallet updates are atomic.
router.post("/loyalty/admin/campaigns/:id/execute", ...adminManage, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

  const startTime = Date.now();

  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
    if (!campaign.isActive) return res.status(409).json({ error: "لا يمكن تنفيذ حملة غير نشطة" });

    // Fetch customer wallets matching the campaign's target
    let allWallets: { id: number; userId: number; coinsBalance: number; lifetimeEarned: number }[];

    if (campaign.target === "manual") {
      // Manual campaigns must specify recipient user ids via segmentFilter.userIds
      const manualUserIds: number[] = Array.isArray((campaign.segmentFilter as any)?.userIds)
        ? (campaign.segmentFilter as any).userIds.map((n: any) => parseInt(n)).filter((n: number) => !isNaN(n))
        : [];

      if (manualUserIds.length === 0) {
        return res.status(400).json({ error: "لم يتم تحديد عملاء لهذه الحملة اليدوية" });
      }

      allWallets = await db
        .select({
          id:             customerWalletsTable.id,
          userId:         customerWalletsTable.userId,
          coinsBalance:   customerWalletsTable.coinsBalance,
          lifetimeEarned: customerWalletsTable.lifetimeEarned,
        })
        .from(customerWalletsTable)
        .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
        .where(and(eq(usersTable.role, "customer"), eq(usersTable.isFounder, false), inArray(customerWalletsTable.userId, manualUserIds)));
    } else if (campaign.target === "registration_range") {
      // Registration campaigns are eligible strictly by the customer's
      // registration timestamp. No request/activity/segment data is involved.
      if (!campaign.startsAt || !campaign.endsAt) {
        return res.status(409).json({ error: "حملة التسجيل تفتقد فترة التسجيل المطلوبة" });
      }

      allWallets = await db
        .select({
          id:             customerWalletsTable.id,
          userId:         customerWalletsTable.userId,
          coinsBalance:   customerWalletsTable.coinsBalance,
          lifetimeEarned: customerWalletsTable.lifetimeEarned,
        })
        .from(customerWalletsTable)
        .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
        .where(and(
          eq(usersTable.role, "customer"),
          eq(usersTable.isFounder, false),
          gte(usersTable.createdAt, campaign.startsAt),
          lte(usersTable.createdAt, campaign.endsAt),
        ));
    } else if (campaign.target === "inactive_customers") {
      const inactivityDays = parseInactivityDays(campaign.segmentFilter);
      if (inactivityDays === null) {
        return res.status(409).json({ error: "حملة عدم النشاط تفتقد فترة عدم النشاط المطلوبة" });
      }

      // A completed request at the cutoff is still within the inactivity
      // window. Customers with no completed request in this window qualify.
      const executionNow = new Date();
      const inactivityCutoff = new Date(
        executionNow.getTime() - inactivityDays * 24 * 60 * 60 * 1000,
      );

      allWallets = await db
        .select({
          id:             customerWalletsTable.id,
          userId:         customerWalletsTable.userId,
          coinsBalance:   customerWalletsTable.coinsBalance,
          lifetimeEarned: customerWalletsTable.lifetimeEarned,
        })
        .from(customerWalletsTable)
        .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
        .leftJoin(
          serviceRequestsTable,
          and(
            eq(serviceRequestsTable.customerId, customerWalletsTable.userId),
            eq(serviceRequestsTable.status, "completed"),
            gte(serviceRequestsTable.updatedAt, inactivityCutoff),
            lte(serviceRequestsTable.updatedAt, executionNow),
          ),
        )
        .where(and(
          eq(usersTable.role, "customer"),
          eq(usersTable.isFounder, false),
          isNull(serviceRequestsTable.id),
        ));
    } else if (campaign.target === "service_based") {
      const serviceFilter = parseServiceBasedFilter(campaign.segmentFilter);
      if (serviceFilter === null) {
        return res.status(409).json({ error: "حملة الخدمة تفتقد الخدمة أو نوع الاستخدام المطلوب" });
      }

      const serviceUsageJoin = and(
        eq(serviceRequestsTable.customerId, customerWalletsTable.userId),
        eq(serviceRequestsTable.serviceId, serviceFilter.serviceId),
        eq(serviceRequestsTable.status, "completed"),
      );

      const serviceQuery = serviceFilter.serviceUsage === "used"
        ? db.selectDistinct
        : db.select;
      const serviceWalletQuery = serviceQuery({
        id:             customerWalletsTable.id,
        userId:         customerWalletsTable.userId,
        coinsBalance:   customerWalletsTable.coinsBalance,
        lifetimeEarned: customerWalletsTable.lifetimeEarned,
      })
        .from(customerWalletsTable)
        .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
        .leftJoin(serviceRequestsTable, serviceUsageJoin)
        .where(and(
          eq(usersTable.role, "customer"),
          eq(usersTable.isFounder, false),
          serviceFilter.serviceUsage === "used"
            ? isNotNull(serviceRequestsTable.id)
            : isNull(serviceRequestsTable.id),
        ));

      allWallets = await serviceWalletQuery;
    } else if (campaign.target === "location_based") {
      const locationFilter = parseLocationBasedFilter(campaign.segmentFilter);
      if (locationFilter === null) {
        return res.status(409).json({ error: "حملة الموقع تفتقد الموقع أو نوع النشاط المطلوب" });
      }

      const locationRequestJoin = and(
        eq(serviceRequestsTable.customerId, customerWalletsTable.userId),
        eq(serviceRequestsTable.status, "completed"),
        locationFilter.locationType === "governorate"
          ? eq(serviceRequestsTable.governorateId, locationFilter.governorateId)
          : eq(serviceRequestsTable.areaId, locationFilter.areaId!),
      );

      const locationQuery = locationFilter.activity === "used"
        ? db.selectDistinct
        : db.select;
      const locationWalletQuery = locationQuery({
        id:             customerWalletsTable.id,
        userId:         customerWalletsTable.userId,
        coinsBalance:   customerWalletsTable.coinsBalance,
        lifetimeEarned: customerWalletsTable.lifetimeEarned,
      })
        .from(customerWalletsTable)
        .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
        .leftJoin(serviceRequestsTable, locationRequestJoin)
        .where(and(
          eq(usersTable.role, "customer"),
          eq(usersTable.isFounder, false),
          locationFilter.activity === "used"
            ? isNotNull(serviceRequestsTable.id)
            : isNull(serviceRequestsTable.id),
        ));

      allWallets = await locationWalletQuery;
    } else if (campaign.target === "spending_based") {
      const spendingFilter = parseSpendingBasedFilter(campaign.segmentFilter);
      if (spendingFilter === null) {
        return res.status(409).json({ error: "حملة الإنفاق تفتقد حد الإنفاق أو فترة الإنفاق المطلوبة" });
      }

      // customer_payable_amount is the authoritative customer-paid amount:
      // offer selection initializes it from the final agreed total, coin
      // redemption reduces it, and price changes preserve the active discount.
      // Legacy completed rows may predate that column, so agreed_price is used
      // only as a no-discount compatibility fallback.
      const spendingDateFilter = spendingFilter.spendingPeriod === "custom"
        ? sql`
            AND sr.updated_at >= ${new Date(spendingFilter.startsAt!)}
            AND sr.updated_at <= ${new Date(spendingFilter.endsAt!)}
          `
        : sql``;

      const spendingRows = await db.execute(sql`
        SELECT
          cw.id AS "id",
          cw.user_id AS "userId",
          cw.coins_balance AS "coinsBalance",
          cw.lifetime_earned AS "lifetimeEarned"
        FROM customer_wallets cw
        INNER JOIN users u ON u.id = cw.user_id
        LEFT JOIN (
          SELECT
            sr.customer_id AS customer_id,
            COALESCE(
              SUM(COALESCE(sr.customer_payable_amount, sr.agreed_price, 0)),
              0
            ) AS total_spending
          FROM service_requests sr
          WHERE sr.status = 'completed'
          ${spendingDateFilter}
          GROUP BY sr.customer_id
        ) spending ON spending.customer_id = cw.user_id
        WHERE u.role = 'customer'
          AND u.is_founder = FALSE
          AND COALESCE(spending.total_spending, 0) >= ${spendingFilter.minimumSpending}
      `);

      allWallets = spendingRows.rows.map((row: any) => ({
        id: Number(row.id),
        userId: Number(row.userId),
        coinsBalance: Number(row.coinsBalance),
        lifetimeEarned: Number(row.lifetimeEarned),
      }));
    } else if (campaign.target === "completed_services") {
      const completedServicesFilter = parseCompletedServicesFilter(campaign.segmentFilter);
      if (completedServicesFilter === null) {
        return res.status(409).json({ error: "حملة الخدمات المكتملة تفتقد الحد الأدنى أو فترة الاحتساب المطلوبة" });
      }

      // A request's updated_at is the existing completion-time convention:
      // the customer confirmation transition sets status=completed and
      // updated_at together. The grouped subquery emits one row per customer,
      // so each completed request is counted exactly once.
      const completedServicesDateFilter = completedServicesFilter.completedServicesPeriod === "custom"
        ? sql`
            AND sr.updated_at >= ${new Date(completedServicesFilter.startsAt!)}
            AND sr.updated_at <= ${new Date(completedServicesFilter.endsAt!)}
          `
        : sql``;

      const completedServicesRows = await db.execute(sql`
        SELECT
          cw.id AS "id",
          cw.user_id AS "userId",
          cw.coins_balance AS "coinsBalance",
          cw.lifetime_earned AS "lifetimeEarned"
        FROM customer_wallets cw
        INNER JOIN users u ON u.id = cw.user_id
        INNER JOIN (
          SELECT
            sr.customer_id AS customer_id,
            COUNT(*) AS completed_services
          FROM service_requests sr
          WHERE sr.status = 'completed'
          ${completedServicesDateFilter}
          GROUP BY sr.customer_id
        ) completed ON completed.customer_id = cw.user_id
        WHERE u.role = 'customer'
          AND u.is_founder = FALSE
          AND completed.completed_services >= ${completedServicesFilter.minimumCompletedServices}
      `);

      allWallets = completedServicesRows.rows.map((row: any) => ({
        id: Number(row.id),
        userId: Number(row.userId),
        coinsBalance: Number(row.coinsBalance),
        lifetimeEarned: Number(row.lifetimeEarned),
      }));
    } else {
      allWallets = await db
        .select({
          id:             customerWalletsTable.id,
          userId:         customerWalletsTable.userId,
          coinsBalance:   customerWalletsTable.coinsBalance,
          lifetimeEarned: customerWalletsTable.lifetimeEarned,
        })
        .from(customerWalletsTable)
        .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
        .where(and(eq(usersTable.role, "customer"), eq(usersTable.isFounder, false)));
    }

    // Wallets that already received this campaign
    const alreadyDone = await db
      .select({ walletId: campaignDistributionsTable.walletId })
      .from(campaignDistributionsTable)
      .where(eq(campaignDistributionsTable.campaignId, id));

    const doneSet = new Set(alreadyDone.map((r) => r.walletId));
    const targets  = allWallets.filter((w) => !doneSet.has(w.id));
    const skipped  = allWallets.length - targets.length;

    // Insert execution log placeholder
    const [execLog] = await db.insert(campaignExecutionLogsTable).values({
      campaignId:           id,
      executedBy:           req.user!.id > 0 ? req.user!.id : null,
      status:               "success",
      customersTargeted:    allWallets.length,
      customersSkipped:     skipped,
      customersRewarded:    0,
      totalCoinsDistributed: 0,
    }).returning();

    let rewarded   = 0;
    let totalCoins = 0;
    const rewardedUserIds: number[] = [];

    try {
      await db.transaction(async (tx: any) => {
        for (const wallet of targets) {
          // Claim the distribution row FIRST — this is the idempotency gate.
          // If a concurrent execution already inserted this (campaignId, walletId) pair,
          // the insert is a no-op and returns nothing, so we skip crediting the wallet.
          const [claimed] = await tx.insert(campaignDistributionsTable).values({
            campaignId:     id,
            walletId:       wallet.id,
            userId:         wallet.userId,
            coinsAwarded:   campaign.coinsAmount,
            executionLogId: execLog.id,
          }).onConflictDoNothing().returning({ id: campaignDistributionsTable.id });

          if (!claimed) continue; // already rewarded by another concurrent run

          // Re-read wallet WITH FOR UPDATE inside the transaction so concurrent
          // scheduler runs (expireAvailableCoins, maturePendingCoins) cannot race
          // with this credit and cause a lost-update on coins_balance.
          const [lockedWallet] = await tx
            .select()
            .from(customerWalletsTable)
            .where(eq(customerWalletsTable.id, wallet.id))
            .for("update")
            .limit(1);
          if (!lockedWallet) continue; // defensive; should never happen

          const newBalance  = lockedWallet.coinsBalance  + campaign.coinsAmount;
          const newLifetime = lockedWallet.lifetimeEarned + campaign.coinsAmount;

          await tx.update(customerWalletsTable)
            .set({ coinsBalance: newBalance, lifetimeEarned: newLifetime, updatedAt: new Date() })
            .where(eq(customerWalletsTable.id, wallet.id));

          await tx.insert(coinTransactionsTable).values({
            walletId:    wallet.id,
            userId:      wallet.userId,
            amount:      campaign.coinsAmount,
            type:        "campaign",
            description: campaign.nameAr || campaign.name,
            balanceAfter: newBalance,
            sourceType:  "campaign",
            sourceId:    id,
            adminId:     req.user!.id > 0 ? req.user!.id : null,
            performedBy: "admin",
          });

          rewarded++;
          totalCoins += campaign.coinsAmount;
          rewardedUserIds.push(wallet.userId);
        }
      });

      const durationMs = Date.now() - startTime;
      await db.update(campaignExecutionLogsTable)
        .set({ customersRewarded: rewarded, totalCoinsDistributed: totalCoins, durationMs })
        .where(eq(campaignExecutionLogsTable.id, execLog.id));

      try {
        await logActivity(req.user!.id, "campaign_executed",
          `campaignId=${id}, rewarded=${rewarded}, coins=${totalCoins}`, req.ip);
      } catch {}

      // SSE: notify each rewarded customer of wallet update — non-blocking
      if (rewardedUserIds.length > 0) {
        try {
          const { broadcastToUsers } = await import("../lib/sse-broadcast");
          broadcastToUsers(rewardedUserIds, "wallet_updated", { type: "campaign_reward", coins: campaign.coinsAmount });
            broadcastToUsers(rewardedUserIds, "notification", {});
        } catch {}
        // In-app + push: notify rewarded customers. The service preserves the
        // existing 500-recipient push cap while recording all in-app rows.
        try {
          const { NotificationService } = await import("../lib/notification-service");
          await NotificationService.notifyCampaignReward(
            rewardedUserIds,
            campaign.coinsAmount,
            campaign.notificationTitle,
            campaign.notificationBody,
          );
        } catch {}
      }

      return res.json({
        message:               "تم تنفيذ الحملة بنجاح",
        customersTargeted:     allWallets.length,
        customersSkipped:      skipped,
        customersRewarded:     rewarded,
        totalCoinsDistributed: totalCoins,
        durationMs,
      });
    } catch (txErr) {
      await db.update(campaignExecutionLogsTable)
        .set({ status: "failed", errorMessage: String(txErr), durationMs: Date.now() - startTime })
        .where(eq(campaignExecutionLogsTable.id, execLog.id))
        .catch(() => {});
      if (!res.headersSent) return res.status(500).json({ error: "فشل تنفيذ الحملة" });
    return;
    }
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/campaigns/executions ──────────────────────────────────
// All execution logs (newest first), paginated.
router.get("/loyalty/admin/campaigns/executions", ...adminView, async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [{ total }] = await db.select({ total: count() }).from(campaignExecutionLogsTable);

    const execAlias    = db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).as("exec_u");

    const logs = await db
      .select({
        id:                    campaignExecutionLogsTable.id,
        campaignId:            campaignExecutionLogsTable.campaignId,
        status:                campaignExecutionLogsTable.status,
        customersTargeted:     campaignExecutionLogsTable.customersTargeted,
        customersSkipped:      campaignExecutionLogsTable.customersSkipped,
        customersRewarded:     campaignExecutionLogsTable.customersRewarded,
        totalCoinsDistributed: campaignExecutionLogsTable.totalCoinsDistributed,
        durationMs:            campaignExecutionLogsTable.durationMs,
        errorMessage:          campaignExecutionLogsTable.errorMessage,
        createdAt:             campaignExecutionLogsTable.createdAt,
        campaignName:          campaignsTable.nameAr,
        campaignCoins:         campaignsTable.coinsAmount,
        executorName:          execAlias.fullName,
      })
      .from(campaignExecutionLogsTable)
      .leftJoin(campaignsTable, eq(campaignExecutionLogsTable.campaignId, campaignsTable.id))
      .leftJoin(execAlias, eq(campaignExecutionLogsTable.executedBy, execAlias.id))
      .orderBy(desc(campaignExecutionLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({ logs, total: Number(total), page, limit });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/campaigns/:id/executions ──────────────────────────────
// Execution history for a single campaign.
router.get("/loyalty/admin/campaigns/:id/executions", ...adminView, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

    const [campaign] = await db.select({ id: campaignsTable.id, nameAr: campaignsTable.nameAr, coinsAmount: campaignsTable.coinsAmount })
      .from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });

    const execAlias = db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).as("exec_u2");

    const logs = await db
      .select({
        id:                    campaignExecutionLogsTable.id,
        status:                campaignExecutionLogsTable.status,
        customersTargeted:     campaignExecutionLogsTable.customersTargeted,
        customersSkipped:      campaignExecutionLogsTable.customersSkipped,
        customersRewarded:     campaignExecutionLogsTable.customersRewarded,
        totalCoinsDistributed: campaignExecutionLogsTable.totalCoinsDistributed,
        durationMs:            campaignExecutionLogsTable.durationMs,
        errorMessage:          campaignExecutionLogsTable.errorMessage,
        createdAt:             campaignExecutionLogsTable.createdAt,
        executorName:          execAlias.fullName,
      })
      .from(campaignExecutionLogsTable)
      .leftJoin(execAlias, eq(campaignExecutionLogsTable.executedBy, execAlias.id))
      .where(eq(campaignExecutionLogsTable.campaignId, id))
      .orderBy(desc(campaignExecutionLogsTable.createdAt));

    // Total distributions for this campaign
    const [{ distributed }] = await db
      .select({ distributed: count() })
      .from(campaignDistributionsTable)
      .where(eq(campaignDistributionsTable.campaignId, id));

    return res.json({ campaign, logs, totalDistributed: Number(distributed) });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── GET /loyalty/admin/reports ───────────────────────────────────────────────
// Comprehensive loyalty analytics report.
router.get("/loyalty/admin/reports", ...adminView, async (req, res) => {
  try {
    // Coins by transaction type
    const coinsByType = await db
      .select({
        type:  coinTransactionsTable.type,
        total: sql<number>`coalesce(sum(amount),0)`,
        txns:  count(),
      })
      .from(coinTransactionsTable)
      .groupBy(coinTransactionsTable.type)
      .orderBy(desc(sql<number>`sum(amount)`));

    // Top 10 earners
    const topEarners = await db
      .select({
        userId:         customerWalletsTable.userId,
        userName:       usersTable.fullName,
        userMobile:     usersTable.mobile,
        lifetimeEarned: customerWalletsTable.lifetimeEarned,
        lifetimeUsed:   customerWalletsTable.lifetimeUsed,
        coinsBalance:   customerWalletsTable.coinsBalance,
      })
      .from(customerWalletsTable)
      .leftJoin(usersTable, eq(customerWalletsTable.userId, usersTable.id))
      .orderBy(desc(customerWalletsTable.lifetimeEarned))
      .limit(10);

    // Top campaigns by coins distributed
    const topCampaigns = await db
      .select({
        campaignId:       campaignDistributionsTable.campaignId,
        campaignName:     campaignsTable.nameAr,
        totalCoins:       sql<number>`coalesce(sum(${campaignDistributionsTable.coinsAwarded}),0)`,
        customersReached: count(),
      })
      .from(campaignDistributionsTable)
      .leftJoin(campaignsTable, eq(campaignDistributionsTable.campaignId, campaignsTable.id))
      .groupBy(campaignDistributionsTable.campaignId, campaignsTable.nameAr)
      .orderBy(desc(sql<number>`sum(${campaignDistributionsTable.coinsAwarded})`))
      .limit(10);

    // Platform credit summary
    const [creditSummary] = await db
      .select({
        totalAmount:   sql<string>`coalesce(sum(amount),0)`,
        paidAmount:    sql<string>`coalesce(sum(case when status='paid' then amount else 0 end),0)`,
        pendingAmount: sql<string>`coalesce(sum(case when status='pending_settlement' then amount else 0 end),0)`,
        paidCount:     sql<number>`sum(case when status='paid' then 1 else 0 end)`,
        pendingCount:  sql<number>`sum(case when status='pending_settlement' then 1 else 0 end)`,
      })
      .from(platformCreditsTable);

    // Referral stats
    const [referralStats] = await db
      .select({
        total:     count(),
        completed: sql<number>`sum(case when status='completed' then 1 else 0 end)`,
        pending:   sql<number>`sum(case when status='pending' then 1 else 0 end)`,
        flagged:   sql<number>`sum(case when status='fraud_flagged' then 1 else 0 end)`,
      })
      .from(referralsTable);

    // Wallet summary
    const [walletSummary] = await db
      .select({
        totalWallets:   count(),
        totalAvailable: sql<number>`coalesce(sum(coins_balance),0)`,
        totalPending:   sql<number>`coalesce(sum(pending_coins),0)`,
        totalReserved:  sql<number>`coalesce(sum(reserved_coins),0)`,
        totalLifetimeEarned: sql<number>`coalesce(sum(lifetime_earned),0)`,
        totalLifetimeUsed:   sql<number>`coalesce(sum(lifetime_used),0)`,
      })
      .from(customerWalletsTable);

    // Total execution runs
    const [execStats] = await db
      .select({
        totalRuns:   count(),
        totalCoins:  sql<number>`coalesce(sum(total_coins_distributed),0)`,
        totalCustomers: sql<number>`coalesce(sum(customers_rewarded),0)`,
      })
      .from(campaignExecutionLogsTable)
      .where(eq(campaignExecutionLogsTable.status, "success"));

    return res.json({
      coinsByType,
      topEarners,
      topCampaigns,
      creditSummary,
      referralStats,
      walletSummary,
      campaignExecStats: execStats,
    });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

// ─── POST /loyalty/admin/run-scheduler ────────────────────────────────────────
// Admin-triggered manual scheduler run (for testing / recovery).
// Requires loyalty.manage permission.
// Runs both maturePendingCoins and expireAvailableCoins sequentially and
// returns their results so the caller can verify the outcome.
router.post("/loyalty/admin/run-scheduler", ...adminManage, async (_req, res) => {
  try {
    const [maturation, expiry] = await Promise.all([
      maturePendingCoins(),
      expireAvailableCoins(),
    ]);
    return res.json({
      maturation,
      expiry,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: "حدث خطأ في الخادم" });
    return;
  }
});

export default router;

