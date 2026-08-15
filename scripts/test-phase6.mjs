/**
 * Phase 6 Functional Test Suite
 * Tests: request completion lifecycle, earnCoins idempotency, atomic status transition race guard.
 *
 * Run from workspace root:
 *   node scripts/test-phase6.mjs
 */

import pg  from "../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
import jwt from "../node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken/index.js";

const { Pool } = pg;

// ── Config ───────────────────────────────────────────────────────────────────
const API        = "http://localhost:8080";
const DB_URL     = process.env.DATABASE_URL;
const JWT_SECRET = process.env.SESSION_SECRET || "fnashha-secret-key-2024";

if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: DB_URL });

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ": " + detail : ""}`);
    failed++;
  }
}

async function query(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

function makeToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
}

async function apiCall(method, path, body, token, waitMs = 0) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = {}; }
  // Secondary ops (earnCoins, notifications, audit) run after res.json() is sent.
  // Give the server a moment to finish them before we query the DB.
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
  return { status: res.status, body: json };
}

// ── CMS helper ───────────────────────────────────────────────────────────────
async function setCMS(key, value) {
  await query(
    `INSERT INTO cms_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)]
  );
}

async function applyLoyaltyConfig({
  loyaltyEnabled     = true,
  minRequestValue    = 100,
  coinConversionRatio = 0.1,
  maxCoinsPerRequest = 500,
  pendingCoinDays    = 0,
  earnCoinsOnDiscount = false,
  referralEnabled    = false,
} = {}) {
  await setCMS("loyaltyEnabled",      loyaltyEnabled);
  await setCMS("minRequestValue",     minRequestValue);
  await setCMS("coinConversionRatio", coinConversionRatio);
  await setCMS("maxCoinsPerRequest",  maxCoinsPerRequest);
  await setCMS("pendingCoinDays",     pendingCoinDays);
  await setCMS("earnCoinsOnDiscount", earnCoinsOnDiscount);
  await setCMS("referralEnabled",     referralEnabled);
}

// ── Seed scenario ─────────────────────────────────────────────────────────────
async function seedScenario({ loyaltyEnabled = true, agreedPrice = 500, hasDiscount = false, pendingCoinDays = 0 } = {}) {
  const ts       = Date.now();
  const custMobile = `9900${ts}`;
  const techMobile = `9901${ts}`;

  await applyLoyaltyConfig({ loyaltyEnabled, pendingCoinDays });

  // Create customer
  const [cust] = await query(`
    INSERT INTO users (full_name, mobile, password_hash, role, status, referral_code)
    VALUES ('Test Customer', $1, 'hash', 'customer', 'active', $2)
    RETURNING id, mobile, role
  `, [custMobile, `RC${ts}`]);

  // Seed wallet
  await query(`
    INSERT INTO customer_wallets (user_id, coins_balance, pending_coins, reserved_coins, lifetime_earned, lifetime_used)
    VALUES ($1, 0, 0, 0, 0, 0)
  `, [cust.id]);

  // Create technician user
  const [tech] = await query(`
    INSERT INTO users (full_name, mobile, password_hash, role, status)
    VALUES ('Test Technician', $1, 'hash', 'technician', 'active')
    RETURNING id, mobile, role
  `, [techMobile]);

  // Technician profile (approval_status enum: 'pending'|'approved'|'rejected')
  const [techProfile] = await query(`
    INSERT INTO technician_profiles (user_id, national_id, approval_status, points_balance, reserved_points)
    VALUES ($1, '12345678901234', 'approved', 100, 0)
    RETURNING id
  `, [tech.id]);

  // Get any service + location
  const [svc]  = await query(`SELECT id FROM services LIMIT 1`);
  const [gov]  = await query(`SELECT id FROM governorates LIMIT 1`);
  const [area] = await query(`SELECT id FROM areas WHERE governorate_id = $1 LIMIT 1`, [gov?.id]);

  if (!svc || !gov || !area) throw new Error("Seed data missing: need at least one service, governorate, and area in DB");

  // Create service request in waiting_approval state
  const [req] = await query(`
    INSERT INTO service_requests
      (customer_id, service_id, governorate_id, area_id,
       full_name, mobile, address, description, status,
       agreed_price, has_discount, selected_technician_id,
       created_at, updated_at)
    VALUES ($1, $2, $3, $4,
            'Test Customer', $5, 'Test Address', 'Phase 6 test request', 'waiting_approval',
            $6, $7, $8,
            now(), now())
    RETURNING id
  `, [cust.id, svc.id, gov.id, area.id, custMobile, agreedPrice, hasDiscount, tech.id]);

  // Selected offer for commission deduction path
  await query(`
    INSERT INTO offers (request_id, technician_id, price, status, reserved_points, created_at)
    VALUES ($1, $2, $3, 'selected', 10, now())
  `, [req.id, tech.id, agreedPrice]);

  const custToken = makeToken({ id: cust.id, mobile: cust.mobile, role: cust.role });

  return {
    custId: cust.id, custMobile, custToken,
    techId: tech.id, techMobile, techProfileId: techProfile.id,
    requestId: req.id,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup(custMobile, techMobile) {
  // Resolve IDs first so all deletes below are ID-scoped (avoids cross-test interference)
  const custRows = await query(`SELECT id FROM users WHERE mobile = $1`, [custMobile]);
  const techRows = await query(`SELECT id FROM users WHERE mobile = $1`, [techMobile]);
  const custId   = custRows[0]?.id;
  const techId   = techRows[0]?.id;
  if (!custId && !techId) return; // already gone

  // Get request IDs for this customer
  const reqRows = custId
    ? await query(`SELECT id FROM service_requests WHERE customer_id = $1`, [custId])
    : [];
  const reqIds = reqRows.map(r => r.id);

  // Get technician profile IDs
  const profileRows = techId
    ? await query(`SELECT id FROM technician_profiles WHERE user_id = $1`, [techId])
    : [];
  const profileIds = profileRows.map(r => r.id);

  // Delete in FK-safe order
  if (reqIds.length) {
    await query(`DELETE FROM coin_transactions WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM coin_redemptions  WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM point_transactions WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM audit_trail       WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM notifications     WHERE related_id  = ANY($1::int[]) AND user_id IN (SELECT id FROM users WHERE mobile IN ($2,$3))`, [reqIds, custMobile, techMobile]);
    await query(`DELETE FROM offers            WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM service_requests  WHERE id         = ANY($1::int[])`, [reqIds]);
  }
  if (custId)         await query(`DELETE FROM customer_wallets    WHERE user_id = $1`, [custId]);
  if (custId || techId) {
    const userIds = [custId, techId].filter(Boolean);
    await query(`DELETE FROM referrals WHERE referee_id = ANY($1::int[]) OR referrer_id = ANY($1::int[])`, [userIds]);
    await query(`DELETE FROM notifications WHERE user_id = ANY($1::int[])`, [userIds]);
    await query(`DELETE FROM coin_transactions WHERE user_id = ANY($1::int[])`, [userIds]);
  }
  if (profileIds.length) {
    await query(`DELETE FROM point_transactions WHERE technician_id = ANY($1::int[])`, [profileIds]);
    await query(`DELETE FROM technician_profiles WHERE id = ANY($1::int[])`, [profileIds]);
  }
  await query(`DELETE FROM users WHERE mobile IN ($1,$2)`, [custMobile, techMobile]);
}

// ── DB helpers ────────────────────────────────────────────────────────────────
const getWallet     = async (userId)    => (await query(`SELECT * FROM customer_wallets WHERE user_id = $1`, [userId]))[0];
const getEarnTxns   = async (requestId) => query(`SELECT * FROM coin_transactions WHERE request_id = $1 AND type IN ('earn_pending','earn_available') AND cancelled = false`, [requestId]);
const getReqStatus  = async (id)        => ((await query(`SELECT status FROM service_requests WHERE id = $1`, [id]))[0])?.status;

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═════════════════════════════════════════════════════════════════════════════
async function runTests() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" Phase 6 Functional Test Suite — Loyalty Request Completion");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── T1: Successful completion → earn_available (pendingCoinDays=0) ─────────
  console.log("T1: Successful completion → earn_available coins (pendingCoinDays=0)");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500, pendingCoinDays: 0 });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 500);
      ok("T1.1 – HTTP 200", r.status === 200, JSON.stringify(r.body));

      const status = await getReqStatus(s.requestId);
      ok("T1.2 – status = completed", status === "completed");

      const txns = await getEarnTxns(s.requestId);
      ok("T1.3 – exactly one earn_available txn", txns.length === 1, `got ${txns.length}`);
      ok("T1.4 – txn.type = earn_available", txns[0]?.type === "earn_available");

      const expected = Math.min(Math.floor(500 * 0.1), 500); // 50
      ok("T1.5 – txn.amount correct", Number(txns[0]?.amount) === expected, `want ${expected}, got ${txns[0]?.amount}`);

      const wallet = await getWallet(s.custId);
      ok("T1.6 – wallet.coins_balance updated", Number(wallet.coins_balance) === expected, `want ${expected}, got ${wallet.coins_balance}`);
      ok("T1.7 – wallet.lifetime_earned updated", Number(wallet.lifetime_earned) === expected);
      ok("T1.8 – wallet.pending_coins unchanged (0)", Number(wallet.pending_coins) === 0);
    } finally { await cleanup(s.custMobile, s.techMobile); }
  }

  // ── T2: Successful completion → earn_pending (pendingCoinDays > 0) ─────────
  console.log("\nT2: Successful completion → earn_pending coins (pendingCoinDays=3)");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500, pendingCoinDays: 3 });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 500);
      ok("T2.1 – HTTP 200", r.status === 200);

      const txns = await getEarnTxns(s.requestId);
      ok("T2.2 – one earn_pending txn inserted", txns.length === 1 && txns[0]?.type === "earn_pending", `type=${txns[0]?.type}`);
      ok("T2.3 – expires_at is set", txns[0]?.expires_at !== null);

      const expected = Math.min(Math.floor(500 * 0.1), 500); // 50
      const wallet = await getWallet(s.custId);
      ok("T2.4 – pending_coins = expected", Number(wallet.pending_coins) === expected, `want ${expected}, got ${wallet.pending_coins}`);
      ok("T2.5 – coins_balance unchanged (0)", Number(wallet.coins_balance) === 0);
      ok("T2.6 – lifetime_earned updated", Number(wallet.lifetime_earned) === expected);
    } finally { await cleanup(s.custMobile, s.techMobile); }
  }

  // ── T3: loyaltyEnabled=false → no coins earned ─────────────────────────────
  console.log("\nT3: loyaltyEnabled=false → completion succeeds but zero coins");
  {
    const s = await seedScenario({ loyaltyEnabled: false, agreedPrice: 500 });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 400);
      ok("T3.1 – HTTP 200", r.status === 200);

      const txns = await getEarnTxns(s.requestId);
      ok("T3.2 – zero earn txns", txns.length === 0, `got ${txns.length}`);

      const wallet = await getWallet(s.custId);
      ok("T3.3 – wallet.coins_balance = 0", Number(wallet.coins_balance) === 0);
    } finally {
      await setCMS("loyaltyEnabled", "true");
      await cleanup(s.custMobile, s.techMobile);
    }
  }

  // ── T4: hasDiscount=true, earnCoinsOnDiscount=false → no coins ─────────────
  console.log("\nT4: hasDiscount=true + earnCoinsOnDiscount=false → no coins");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500, hasDiscount: true });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 400);
      ok("T4.1 – HTTP 200", r.status === 200);

      const txns = await getEarnTxns(s.requestId);
      ok("T4.2 – zero earn txns (discount blocks earning)", txns.length === 0, `got ${txns.length}`);

      const wallet = await getWallet(s.custId);
      ok("T4.3 – wallet.coins_balance = 0", Number(wallet.coins_balance) === 0);
    } finally { await cleanup(s.custMobile, s.techMobile); }
  }

  // ── T5: Atomic race guard — concurrent calls → exactly one wins ────────────
  console.log("\nT5: Concurrent completion race → second caller gets 409, exactly one earn txn");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500 });
    try {
      // Fire both calls simultaneously, then wait for secondary ops
      const [r1, r2] = await Promise.all([
        apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken),
        apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken),
      ]);
      await new Promise(r => setTimeout(r, 600)); // wait for secondary ops

      const statuses = [r1.status, r2.status].sort();
      // Race resolves at pre-check (→400) or atomic WHERE guard (→409) — both are correct.
      ok("T5.1 – one 200, one 400/409", statuses[0] === 200 && (statuses[1] === 409 || statuses[1] === 400), `got [${statuses}]`);

      const status = await getReqStatus(s.requestId);
      ok("T5.2 – request status = completed", status === "completed");

      // Even if race guard lets one through, idempotency guard in earnCoins must
      // ensure only one earn txn exists.
      const txns = await getEarnTxns(s.requestId);
      ok("T5.3 – exactly one earn txn (belt-and-suspenders idempotency)", txns.length === 1, `got ${txns.length}`);

      const wallet = await getWallet(s.custId);
      const expected = Math.min(Math.floor(500 * 0.1), 500);
      ok("T5.4 – wallet.coins_balance = expected (no double-credit)", Number(wallet.coins_balance) === expected, `want ${expected}, got ${wallet.coins_balance}`);
    } finally { await cleanup(s.custMobile, s.techMobile); }
  }

  // ── T6: Completing a request not in waiting_approval → 400 ────────────────
  console.log("\nT6: Complete on non-waiting_approval request → 400");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500 });
    try {
      // Force to a different status
      await query(`UPDATE service_requests SET status='in_progress' WHERE id=$1`, [s.requestId]);

      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 200);
      ok("T6.1 – HTTP 400", r.status === 400, JSON.stringify(r.body));

      const txns = await getEarnTxns(s.requestId);
      ok("T6.2 – zero earn txns (no completion happened)", txns.length === 0);
    } finally { await cleanup(s.custMobile, s.techMobile); }
  }

  // ── T7: earnCoins idempotency — direct double-call via DB manipulation ─────
  console.log("\nT7: earnCoins idempotency guard — second earn attempt returns 0 (no double-award)");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500 });
    try {
      // First completion — wait for secondary ops
      const r1 = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 500);
      ok("T7.1 – first complete HTTP 200", r1.status === 200);

      const txnsAfterFirst = await getEarnTxns(s.requestId);
      ok("T7.2 – one earn txn after first completion", txnsAfterFirst.length === 1);
      const balanceAfterFirst = Number((await getWallet(s.custId)).coins_balance);

      // Revert status in DB to simulate a second concurrent arrival slipping past
      // the HTTP-level race guard (belt-and-suspenders test for earnCoins itself).
      await query(`UPDATE service_requests SET status='waiting_approval' WHERE id=$1`, [s.requestId]);

      const r2 = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken, 500);
      // May be 200 (idempotent) or 409 (race guard fires again) — must NOT be 500
      ok("T7.3 – second call does not 500", r2.status !== 500, JSON.stringify(r2.body));

      // Critical: no new earn txn must appear
      const txnsAfterSecond = await getEarnTxns(s.requestId);
      ok("T7.4 – still exactly one earn txn (idempotency guard held)", txnsAfterSecond.length === 1, `got ${txnsAfterSecond.length}`);

      const balanceAfterSecond = Number((await getWallet(s.custId)).coins_balance);
      ok("T7.5 – wallet balance unchanged by second call", balanceAfterSecond === balanceAfterFirst, `was ${balanceAfterFirst}, now ${balanceAfterSecond}`);
    } finally { await cleanup(s.custMobile, s.techMobile); }
  }

  // ── T8: Wrong customer cannot complete another customer's request ───────────
  console.log("\nT8: Wrong customer cannot complete another customer's request → 403");
  {
    const s = await seedScenario({ loyaltyEnabled: false, agreedPrice: 200 });
    try {
      const wrongToken = makeToken({ id: s.custId + 9999, mobile: "wrongcust", role: "customer" });
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, wrongToken, 200);
      ok("T8.1 – HTTP 403", r.status === 403, JSON.stringify(r.body));

      const status = await getReqStatus(s.requestId);
      ok("T8.2 – request still waiting_approval", status === "waiting_approval");

      const txns = await getEarnTxns(s.requestId);
      ok("T8.3 – zero earn txns", txns.length === 0);
    } finally {
      await setCMS("loyaltyEnabled", "true");
      await cleanup(s.custMobile, s.techMobile);
    }
  }

  // ── T9: Unauthenticated call → 401 ────────────────────────────────────────
  console.log("\nT9: Unauthenticated call → 401");
  {
    const r = await apiCall("POST", `/api/requests/999/complete`, {});
    ok("T9.1 – HTTP 401", r.status === 401, JSON.stringify(r.body));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(` Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  console.log("══════════════════════════════════════════════════════════════\n");

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async err => {
  console.error("Test suite crashed:", err.message ?? err);
  await pool.end().catch(() => {});
  process.exit(1);
});
