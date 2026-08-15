/**
 * Phase 6 Functional Test Suite
 * Tests: request completion lifecycle, earnCoins idempotency, atomic status transition race guard.
 *
 * Run: DATABASE_URL=... SESSION_SECRET=... node scripts/test-phase6.mjs
 * (env vars already in Replit environment)
 */

import pg from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pg;

// ── Config ───────────────────────────────────────────────────────────────────
const API   = "http://localhost:8080";
const DB_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.SESSION_SECRET || "fnashha-secret-key-2024";

if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: DB_URL });

// ── Helpers ──────────────────────────────────────────────────────────────────
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

async function apiCall(method, path, body, token) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

// ── Test data teardown ───────────────────────────────────────────────────────
async function cleanup(customerPhone, techPhone) {
  // Cleanup in FK-safe order
  await query(`DELETE FROM coin_transactions   WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1,$2))`, [customerPhone, techPhone]);
  await query(`DELETE FROM coin_redemptions    WHERE request_id IN (SELECT id FROM service_requests WHERE customer_id IN (SELECT id FROM users WHERE phone = $1))`, [customerPhone]);
  await query(`DELETE FROM customer_wallets    WHERE user_id IN (SELECT id FROM users WHERE phone = $1)`, [customerPhone]);
  await query(`DELETE FROM referrals           WHERE referee_id IN (SELECT id FROM users WHERE phone = $1) OR referrer_id IN (SELECT id FROM users WHERE phone IN ($1,$2))`, [customerPhone, techPhone]);
  await query(`DELETE FROM point_transactions  WHERE technician_id IN (SELECT id FROM technician_profiles WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1,$2)))`, [customerPhone, techPhone]);
  await query(`DELETE FROM audit_trail         WHERE request_id IN (SELECT id FROM service_requests WHERE customer_id IN (SELECT id FROM users WHERE phone = $1))`, [customerPhone]);
  await query(`DELETE FROM notifications       WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1,$2))`, [customerPhone, techPhone]);
  await query(`DELETE FROM offers              WHERE request_id IN (SELECT id FROM service_requests WHERE customer_id IN (SELECT id FROM users WHERE phone = $1))`, [customerPhone]);
  await query(`DELETE FROM service_requests    WHERE customer_id IN (SELECT id FROM users WHERE phone = $1)`, [customerPhone]);
  await query(`DELETE FROM technician_profiles WHERE user_id IN (SELECT id FROM users WHERE phone IN ($1,$2))`, [customerPhone, techPhone]);
  await query(`DELETE FROM users               WHERE phone IN ($1,$2)`, [customerPhone, techPhone]);
}

// ── Seed: create a minimal customer + tech + request in waiting_approval ─────
async function seedScenario({ loyaltyEnabled = true, agreedPrice = 500, hasDiscount = false, pendingCoinDays = 0 } = {}) {
  const custPhone = `TEST_CUST_${Date.now()}`;
  const techPhone = `TEST_TECH_${Date.now()}`;

  // Enable (or disable) loyalty in CMS
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('loyaltyEnabled', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [loyaltyEnabled ? "true" : "false"]);
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('minRequestValue', '100')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('coinConversionRatio', '0.1')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('maxCoinsPerRequest', '500')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('pendingCoinDays', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [String(pendingCoinDays)]);
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('earnCoinsOnDiscount', 'false')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  await query(`
    INSERT INTO cms_settings (key, value) VALUES ('referralEnabled', 'false')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);

  // Create customer
  const [cust] = await query(`
    INSERT INTO users (phone, name, role, password_hash, referral_code, is_active)
    VALUES ($1, 'Test Customer', 'customer', 'hash', $2, true)
    RETURNING id, phone, role
  `, [custPhone, `RC${Date.now()}`]);

  // Seed wallet
  await query(`
    INSERT INTO customer_wallets (user_id, coins_balance, pending_coins, reserved_coins, lifetime_earned, lifetime_used)
    VALUES ($1, 0, 0, 0, 0, 0)
  `, [cust.id]);

  // Create technician
  const [tech] = await query(`
    INSERT INTO users (phone, name, role, password_hash, is_active)
    VALUES ($1, 'Test Technician', 'technician', 'hash', true)
    RETURNING id, phone, role
  `, [techPhone]);

  const [techProfile] = await query(`
    INSERT INTO technician_profiles (user_id, national_id, points_balance, reserved_points, is_approved)
    VALUES ($1, '12345678901234', 100, 0, true)
    RETURNING id
  `, [tech.id]);

  // Find any service
  const [svc] = await query(`SELECT id FROM services LIMIT 1`);
  const [gov] = await query(`SELECT id FROM governorates LIMIT 1`);
  const [area] = await query(`SELECT id FROM areas WHERE governorate_id = $1 LIMIT 1`, [gov?.id]);

  const svcId  = svc?.id  || null;
  const govId  = gov?.id  || null;
  const areaId = area?.id || null;

  // Create service request in waiting_approval state
  const [req] = await query(`
    INSERT INTO service_requests
      (customer_id, service_id, governorate_id, area_id, description, status,
       agreed_price, has_discount, selected_technician_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 'Phase 6 test request', 'waiting_approval',
            $5, $6, $7, now(), now())
    RETURNING id
  `, [cust.id, svcId, govId, areaId, agreedPrice, hasDiscount, tech.id]);

  // Create a selected offer (so commission deduction path is exercised)
  await query(`
    INSERT INTO offers (request_id, technician_id, price, status, reserved_points, created_at)
    VALUES ($1, $2, $3, 'selected', 10, now())
  `, [req.id, tech.id, agreedPrice]);

  const custToken = makeToken({ id: cust.id, phone: cust.phone, role: cust.role });

  return {
    custId: cust.id, custPhone, custToken,
    techId: tech.id, techPhone, techProfileId: techProfile.id,
    requestId: req.id,
  };
}

async function getWallet(userId) {
  const [row] = await query(`SELECT * FROM customer_wallets WHERE user_id = $1`, [userId]);
  return row;
}

async function getEarnTxns(requestId) {
  return query(`
    SELECT * FROM coin_transactions
    WHERE request_id = $1
      AND type IN ('earn_pending','earn_available')
      AND cancelled = false
  `, [requestId]);
}

async function getRequestStatus(id) {
  const [row] = await query(`SELECT status FROM service_requests WHERE id = $1`, [id]);
  return row?.status;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log(" Phase 6 Functional Test Suite");
  console.log("══════════════════════════════════════════════════════\n");

  // ── T1: Successful completion with loyalty coins earned ───────────────────
  console.log("T1: Successful completion → coins earned (earn_available, pendingCoinDays=0)");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500, pendingCoinDays: 0 });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      ok("T1.1 – HTTP 200", r.status === 200, JSON.stringify(r.body));

      const status = await getRequestStatus(s.requestId);
      ok("T1.2 – status = completed", status === "completed");

      const txns = await getEarnTxns(s.requestId);
      ok("T1.3 – exactly one earn_available txn inserted", txns.length === 1, `got ${txns.length}`);
      ok("T1.4 – txn type = earn_available", txns[0]?.type === "earn_available");

      // agreedPrice 500, coinConversionRatio 0.1 → floor(500*0.1) = 50 coins
      const expected = Math.min(Math.floor(500 * 0.1), 500);
      ok("T1.5 – txn amount correct", Number(txns[0]?.amount) === expected, `want ${expected}, got ${txns[0]?.amount}`);

      const wallet = await getWallet(s.custId);
      ok("T1.6 – wallet coinsBalance updated", Number(wallet.coins_balance) === expected, `want ${expected}, got ${wallet.coins_balance}`);
      ok("T1.7 – wallet lifetimeEarned updated", Number(wallet.lifetime_earned) === expected);
    } finally {
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T2: Successful completion → earn_pending (pendingCoinDays > 0) ────────
  console.log("\nT2: Successful completion → coins earned (earn_pending, pendingCoinDays=3)");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500, pendingCoinDays: 3 });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      ok("T2.1 – HTTP 200", r.status === 200);

      const txns = await getEarnTxns(s.requestId);
      ok("T2.2 – earn_pending txn inserted", txns.length === 1 && txns[0].type === "earn_pending");
      ok("T2.3 – expiresAt is set", txns[0]?.expires_at !== null);

      const wallet = await getWallet(s.custId);
      const expected = Math.min(Math.floor(500 * 0.1), 500);
      ok("T2.4 – pendingCoins updated (not coinsBalance)", Number(wallet.pending_coins) === expected && Number(wallet.coins_balance) === 0);
    } finally {
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T3: Loyalty disabled → no coins earned ────────────────────────────────
  console.log("\nT3: loyaltyEnabled=false → no coins earned");
  {
    const s = await seedScenario({ loyaltyEnabled: false, agreedPrice: 500 });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      ok("T3.1 – HTTP 200", r.status === 200);

      const txns = await getEarnTxns(s.requestId);
      ok("T3.2 – zero earn txns", txns.length === 0, `got ${txns.length}`);

      const wallet = await getWallet(s.custId);
      ok("T3.3 – wallet balance unchanged", Number(wallet.coins_balance) === 0);
    } finally {
      // re-enable loyalty for subsequent tests
      await query(`INSERT INTO cms_settings (key, value) VALUES ('loyaltyEnabled','true') ON CONFLICT (key) DO UPDATE SET value='true'`);
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T4: hasDiscount=true, earnCoinsOnDiscount=false → no coins ───────────
  console.log("\nT4: hasDiscount=true + earnCoinsOnDiscount=false → no coins");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500, hasDiscount: true });
    try {
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      ok("T4.1 – HTTP 200", r.status === 200);

      const txns = await getEarnTxns(s.requestId);
      ok("T4.2 – zero earn txns (discount blocks earning)", txns.length === 0, `got ${txns.length}`);
    } finally {
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T5: Atomic status transition race — second call gets 409 ─────────────
  console.log("\nT5: Concurrent completion race → second caller gets 409");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500 });
    try {
      // Fire both calls simultaneously
      const [r1, r2] = await Promise.all([
        apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken),
        apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken),
      ]);

      const statuses = [r1.status, r2.status].sort();
      ok("T5.1 – one 200 and one 409", statuses[0] === 200 && statuses[1] === 409, `got ${statuses}`);

      // DB must show exactly one earn txn despite two concurrent calls
      const txns = await getEarnTxns(s.requestId);
      ok("T5.2 – exactly one earn txn (idempotency guard)", txns.length === 1, `got ${txns.length}`);

      const status = await getRequestStatus(s.requestId);
      ok("T5.3 – request status = completed", status === "completed");
    } finally {
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T6: Completing a non-waiting_approval request → 400 ──────────────────
  console.log("\nT6: Complete on non-waiting_approval status → 400");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500 });
    try {
      // Force status to 'in_progress' so the route pre-check rejects it
      await query(`UPDATE service_requests SET status='in_progress' WHERE id=$1`, [s.requestId]);

      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      ok("T6.1 – HTTP 400", r.status === 400, JSON.stringify(r.body));

      const txns = await getEarnTxns(s.requestId);
      ok("T6.2 – zero earn txns", txns.length === 0);
    } finally {
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T7: earnCoins idempotency — direct double-call ───────────────────────
  console.log("\nT7: earnCoins idempotency guard — second call returns 0");
  {
    const s = await seedScenario({ loyaltyEnabled: true, agreedPrice: 500 });
    try {
      // First call via API
      const r1 = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      ok("T7.1 – first complete HTTP 200", r1.status === 200);

      const txnsBefore = await getEarnTxns(s.requestId);
      ok("T7.2 – one earn txn after first call", txnsBefore.length === 1);

      const walletBefore = await getWallet(s.custId);

      // Directly seed a second waiting_approval request pointing to same wallet
      // to test earnCoins idempotency at the engine level:
      // we manually insert a duplicate txn attempt by resetting status and re-calling
      await query(`UPDATE service_requests SET status='waiting_approval' WHERE id=$1`, [s.requestId]);

      const r2 = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, s.custToken);
      // The atomic WHERE guard catches this — same requestId, but now its status
      // is waiting_approval again; however the earn idempotency guard inside
      // earnCoins should prevent double-award even if the outer race guard somehow
      // allowed through (belt-and-suspenders).
      // In practice one of: 200 (idempotent) or 409 (race guard fired).
      ok("T7.3 – second call does not 500", r2.status !== 500, JSON.stringify(r2.body));

      const txnsAfter = await getEarnTxns(s.requestId);
      ok("T7.4 – still exactly one earn txn (no double-award)", txnsAfter.length === 1, `got ${txnsAfter.length}`);

      const walletAfter = await getWallet(s.custId);
      ok("T7.5 – wallet balance unchanged by second call", walletAfter.coins_balance === walletBefore.coins_balance);
    } finally {
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── T8: Wrong customer cannot complete another customer's request ──────────
  console.log("\nT8: Wrong customer cannot complete another customer's request → 403");
  {
    const s = await seedScenario({ loyaltyEnabled: false, agreedPrice: 200 });
    try {
      const wrongToken = makeToken({ id: s.custId + 9999, phone: "wrongcust", role: "customer" });
      const r = await apiCall("POST", `/api/requests/${s.requestId}/complete`, {}, wrongToken);
      ok("T8.1 – HTTP 403", r.status === 403, JSON.stringify(r.body));

      const status = await getRequestStatus(s.requestId);
      ok("T8.2 – request still waiting_approval", status === "waiting_approval");
    } finally {
      await query(`INSERT INTO cms_settings (key, value) VALUES ('loyaltyEnabled','true') ON CONFLICT (key) DO UPDATE SET value='true'`);
      await cleanup(s.custPhone, s.techPhone);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════");
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════════\n");

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test suite crashed:", err);
  pool.end();
  process.exit(1);
});
