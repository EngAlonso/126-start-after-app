/**
 * Loyalty Scheduler — Phase 10 (upgraded to node-cron for Mobile Readiness)
 *
 * Runs two background jobs on cron schedules, fully automatically —
 * no manual admin action is required for the loyalty engine to stay
 * accurate in production:
 *
 *   1. maturePendingCoins()  — converts earn_pending transactions whose
 *      expires_at has passed into earn_available (coins_balance++, pending_coins--).
 *      Cron: "*\/30 * * * *" — every 30 minutes.
 *
 *   2. expireAvailableCoins() — expires earn_available transactions whose
 *      expires_at has passed (coins_balance--, inserts expiry transaction).
 *      Cron: "0 * * * *" — every hour, on the hour.
 *
 * These intervals were kept from the original Phase 10 implementation
 * (30 min maturation / 60 min expiry) since they already match the
 * granularity of the underlying accounting rules (expiry is day-grained,
 * so hourly is more than precise enough, while maturation windows can be
 * shorter-lived and benefit from a tighter 30-minute cadence).
 *
 * Both underlying functions are reused as-is (no business-logic duplication)
 * from loyaltyEngine.ts, and are the exact same functions invoked by the
 * manual admin endpoint (POST /loyalty/admin/run-scheduler) — scheduled and
 * manual execution always share one code path.
 *
 * Idempotency: each function is concurrency-safe via UPDATE-RETURNING
 * idempotency gates and SELECT ... FOR UPDATE wallet locks, so overlapping
 * runs (e.g. a manual trigger firing mid-cron-tick) can never double-mature,
 * double-expire, or double-credit a transaction.
 *
 * Error isolation: each cron tick is wrapped so a thrown/rejected error is
 * logged and swallowed — a failure never crashes the API process, and the
 * job simply resumes on its next scheduled tick.
 *
 * The scheduler also runs both jobs once immediately on startup (outside the
 * cron schedule) so that any maturation/expiry windows missed during server
 * downtime are caught right away rather than waiting for the next tick.
 */

import cron, { type ScheduledTask } from "node-cron";
import { logger } from "./logger";
import { maturePendingCoins, expireAvailableCoins, type SchedulerResult } from "./loyaltyEngine";

const MATURATION_CRON = "*/30 * * * *"; // every 30 minutes
const EXPIRY_CRON = "0 * * * *"; // every hour, on the hour

async function runJob(name: string, fn: () => Promise<SchedulerResult>): Promise<void> {
  const startedAt = Date.now();
  logger.info({ job: name }, `[LOYALTY SCHEDULER] ${name} — execution starting`);
  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    logger.info(
      {
        job: name,
        processed: result.processed,
        walletsAffected: result.walletsAffected,
        durationMs,
      },
      `[LOYALTY SCHEDULER] ${name} — execution finished (processed=${result.processed}, walletsAffected=${result.walletsAffected}, durationMs=${durationMs})`
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    // Never let a scheduler failure crash the API — log and let the next
    // scheduled tick (or the next manual trigger) try again.
    logger.error(
      { job: name, durationMs, err: err instanceof Error ? err.message : err },
      `[LOYALTY SCHEDULER] ${name} — execution failed`
    );
  }
}

/**
 * Start the loyalty background scheduler.
 * Call once after the server starts listening (see index.ts). Idempotent to
 * call at most once per process — calling it twice would register duplicate
 * cron tasks, though the underlying jobs themselves remain safe either way.
 * Returns the scheduled tasks (for graceful shutdown / testing).
 */
export function startLoyaltyScheduler(): { maturationTask: ScheduledTask; expiryTask: ScheduledTask; stop: () => void } {
  // Run immediately on startup to catch any windows missed during downtime.
  void runJob("maturePendingCoins (startup)", maturePendingCoins);
  void runJob("expireAvailableCoins (startup)", expireAvailableCoins);

  const maturationTask = cron.schedule(MATURATION_CRON, () => {
    void runJob("maturePendingCoins", maturePendingCoins);
  });

  const expiryTask = cron.schedule(EXPIRY_CRON, () => {
    void runJob("expireAvailableCoins", expireAvailableCoins);
  });

  logger.info(
    { maturationCron: MATURATION_CRON, expiryCron: EXPIRY_CRON },
    "[LOYALTY SCHEDULER] started — running automatically in the background"
  );

  return {
    maturationTask,
    expiryTask,
    stop: () => {
      maturationTask.stop();
      expiryTask.stop();
    },
  };
}
