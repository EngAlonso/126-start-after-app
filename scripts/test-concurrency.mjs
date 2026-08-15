/**
 * Concurrency verification suite for two production-readiness fixes:
 *   1. Atomic offer selection (POST /api/requests/:requestId/offers/:offerId/select)
 *   2. Atomic technician points deduction on request completion
 *
 * Run from workspace root:
 *   node scripts/test-concurrency.mjs
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
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
  return { status: res.status, body: json };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup(mobiles) {
  const userRows = await query(`SELECT id, mobile FROM users WHERE mobile = ANY($1::text[])`, [mobiles]);
  const userIds = userRows.map(r => r.id);
  if (userIds.length === 0) return;

  const reqRows = await query(`SELECT id FROM service_requests WHERE customer_id = ANY($1::int[])`, [userIds]);
  const reqIds = reqRows.map(r => r.id);

  const profileRows = await query(`SELECT id FROM technician_profiles WHERE user_id = ANY($1::int[])`, [userIds]);
  const profileIds = profileRows.map(r => r.id);

  if (reqIds.length) {
    await query(`DELETE FROM coin_transactions WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM coin_redemptions  WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM point_transactions WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM audit_trail       WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM notifications     WHERE related_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM offers            WHERE request_id = ANY($1::int[])`, [reqIds]);
    await query(`DELETE FROM service_requests  WHERE id = ANY($1::int[])`, [reqIds]);
  }
  await query(`DELETE FROM notifications WHERE user_id = ANY($1::int[])`, [userIds]);
  await query(`DELETE FROM customer_wallets WHERE user_id = ANY($1::int[])`, [userIds]);
  if (profileIds.length) {
    await query(`DELETE FROM point_transactions WHERE technician_id = ANY($1::int[])`, [profileIds]);
    await query(`DELETE FROM technician_profiles WHERE id = ANY($1::int[])`, [profileIds]);
  }
  await query(`DELETE FROM users WHERE id = ANY($1::int[])`, [userIds]);
}

async function makeCustomer(ts, suffix) {
  const mobile = `98${suffix}${ts}`;
  const [u] = await query(`
    INSERT INTO users (full_name, mobile, password_hash, role, status, referral_code)
    VALUES ('Concurrency Customer', $1, 'hash', 'customer', 'active', $2)
    RETURNING id, mobile, role
  `, [mobile, `CC${suffix}${ts}`]);
  await query(`
    INSERT INTO customer_wallets (user_id, coins_balance, pending_coins, reserved_coins, lifetime_earned, lifetime_used)
    VALUES ($1, 0, 0, 0, 0, 0)
  `, [u.id]);
  return { ...u, token: makeToken({ id: u.id, mobile: u.mobile, role: u.role }) };
}

async function makeTechnician(ts, suffix, { pointsBalance = 100, reservedPoints = 0 } = {}) {
  const mobile = `99${suffix}${ts}`;
  const [u] = await query(`
    INSERT INTO users (full_name, mobile, password_hash, role, status)
    VALUES ('Concurrency Technician', $1, 'hash', 'technician', 'active')
    RETURNING id, mobile, role
  `, [mobile]);
  const [profile] = await query(`
    INSERT INTO technician_profiles (user_id, national_id, approval_status, points_balance, reserved_points)
    VALUES ($1, $2, 'approved', $3, $4)
    RETURNING id
  `, [u.id, `1${suffix}${ts}`.padEnd(14, "0").slice(0, 14), pointsBalance, reservedPoints]);
  return { ...u, profileId: profile.id, token: makeToken({ id: u.id, mobile: u.mobile, role: u.role }) };
}

async function getSeedLocation() {
  const [svc]  = await query(`SELECT id FROM services LIMIT 1`);
  const [gov]  = await query(`SELECT id FROM governorates LIMIT 1`);
  const [area] = await query(`SELECT id FROM areas WHERE governorate_id = $1 LIMIT 1`, [gov?.id]);
  if (!svc || !gov || !area) throw new Error("Seed data missing: need at least one service, governorate, and area in DB");
  return { svc, gov, area };
}

async function makeRequest({ customerId, mobile, svc, gov, area, status = "offers_received" }) {
  const [req] = await query(`
    INSERT INTO service_requests
      (customer_id, service_id, governorate_id, area_id,
       full_name, mobile, address, description, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4,
            'Concurrency Customer', $5, 'Test Address', 'Concurrency test request', $6,
            now(), now())
    RETURNING id
  `, [customerId, svc.id, gov.id, area.id, mobile, status]);
  return req.id;
}

async function makeOffer({ requestId, technicianId, price, reservedPoints = 10, status = "pending" }) {
  const [offer] = await query(`
    INSERT INTO offers (request_id, technician_id, price, status, reserved_points, created_at)
    VALUES ($1, $2, $3, $4, $5, now())
    RETURNING id
  `, [requestId, technicianId, price, status, reservedPoints]);
  return offer.id;
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═════════════════════════════════════════════════════════════════════════════
async function runTests() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" Concurrency Suite — Atomic Offer Selection & Points Deduction");
  console.log("══════════════════════════════════════════════════════════════\n");

  const ts = Date.now();
  const allMobiles = [];

  // ── T1: Concurrent offer selection on the same request → exactly one wins ──
  console.log("T1: Two offers on one request, selected concurrently → exactly one selected");
  {
    const cust = await makeCustomer(ts, "01");
    // reservedPoints seeded to 15 on each profile — mirrors real flow where
    // submitting an offer already reserves points on the technician's profile
    // (this test starts from "offer already submitted", not from submission).
    const tech1 = await makeTechnician(ts, "01", { pointsBalance: 100, reservedPoints: 15 });
    const tech2 = await makeTechnician(ts, "02", { pointsBalance: 100, reservedPoints: 15 });
    allMobiles.push(cust.mobile, tech1.mobile, tech2.mobile);
    try {
      const { svc, gov, area } = await getSeedLocation();
      const requestId = await makeRequest({ customerId: cust.id, mobile: cust.mobile, svc, gov, area });
      const offer1Id = await makeOffer({ requestId, technicianId: tech1.id, price: "300", reservedPoints: 15 });
      const offer2Id = await makeOffer({ requestId, technicianId: tech2.id, price: "320", reservedPoints: 15 });

      const [r1, r2] = await Promise.all([
        apiCall("POST", `/api/requests/${requestId}/offers/${offer1Id}/select`, {}, cust.token),
        apiCall("POST", `/api/requests/${requestId}/offers/${offer2Id}/select`, {}, cust.token),
      ]);
      await new Promise(r => setTimeout(r, 500)); // let secondary ops (point release) finish

      const statuses = [r1.status, r2.status].sort();
      ok("T1.1 – exactly one 200, one 409", statuses[0] === 200 && statuses[1] === 409, `got [${r1.status}, ${r2.status}]`);

      const offers = await query(`SELECT id, status FROM offers WHERE request_id = $1 ORDER BY id`, [requestId]);
      const selectedCount = offers.filter(o => o.status === "selected").length;
      const rejectedCount = offers.filter(o => o.status === "rejected").length;
      ok("T1.2 – exactly one offer selected", selectedCount === 1, `got ${selectedCount}`);
      ok("T1.3 – exactly one offer rejected", rejectedCount === 1, `got ${rejectedCount}`);

      const [reqRow] = await query(`SELECT status, selected_technician_id FROM service_requests WHERE id = $1`, [requestId]);
      ok("T1.4 – request status = technician_selected", reqRow.status === "technician_selected", reqRow.status);

      // Winning technician's reserved points should be 15 (still reserved until completion);
      // losing technician's reserved points should have been released back to 0.
      const winnerId = reqRow.selected_technician_id;
      const loserId = winnerId === tech1.id ? tech2.id : tech1.id;
      const [winnerProfile] = await query(`SELECT reserved_points FROM technician_profiles WHERE user_id = $1`, [winnerId]);
      const [loserProfile]  = await query(`SELECT reserved_points FROM technician_profiles WHERE user_id = $1`, [loserId]);
      ok("T1.5 – winner keeps reserved points (15)", Number(winnerProfile.reserved_points) === 15, `got ${winnerProfile.reserved_points}`);
      ok("T1.6 – loser's reserved points released (0)", Number(loserProfile.reserved_points) === 0, `got ${loserProfile.reserved_points}`);
    } finally {
      await cleanup([cust.mobile, tech1.mobile, tech2.mobile]);
    }
  }

  // ── T2: Re-selecting an already-selected request → 409, no double state change ─
  console.log("\nT2: Selecting a second offer after the request is already decided → 409");
  {
    const cust = await makeCustomer(ts, "03");
    const tech1 = await makeTechnician(ts, "03", { pointsBalance: 100 });
    const tech2 = await makeTechnician(ts, "04", { pointsBalance: 100 });
    allMobiles.push(cust.mobile, tech1.mobile, tech2.mobile);
    try {
      const { svc, gov, area } = await getSeedLocation();
      const requestId = await makeRequest({ customerId: cust.id, mobile: cust.mobile, svc, gov, area });
      const offer1Id = await makeOffer({ requestId, technicianId: tech1.id, price: "300", reservedPoints: 10 });
      const offer2Id = await makeOffer({ requestId, technicianId: tech2.id, price: "320", reservedPoints: 10 });

      const r1 = await apiCall("POST", `/api/requests/${requestId}/offers/${offer1Id}/select`, {}, cust.token, 300);
      ok("T2.1 – first select HTTP 200", r1.status === 200, JSON.stringify(r1.body));

      const r2 = await apiCall("POST", `/api/requests/${requestId}/offers/${offer2Id}/select`, {}, cust.token);
      ok("T2.2 – second select HTTP 409", r2.status === 409, JSON.stringify(r2.body));

      const [reqRow] = await query(`SELECT selected_technician_id FROM service_requests WHERE id = $1`, [requestId]);
      ok("T2.3 – selected technician unchanged (still tech1)", reqRow.selected_technician_id === tech1.id);
    } finally {
      await cleanup([cust.mobile, tech1.mobile, tech2.mobile]);
    }
  }

  // ── T3: Concurrent completions for two different requests on the SAME technician
  //        profile → both deductions applied, no lost update on points_balance ──
  console.log("\nT3: Concurrent points deduction on shared technician profile → no lost update");
  {
    const cust1 = await makeCustomer(ts, "05");
    const cust2 = await makeCustomer(ts, "06");
    const tech  = await makeTechnician(ts, "05", { pointsBalance: 100, reservedPoints: 30 });
    allMobiles.push(cust1.mobile, cust2.mobile, tech.mobile);
    try {
      const { svc, gov, area } = await getSeedLocation();

      const req1Id = await makeRequest({ customerId: cust1.id, mobile: cust1.mobile, svc, gov, area, status: "waiting_approval" });
      const req2Id = await makeRequest({ customerId: cust2.id, mobile: cust2.mobile, svc, gov, area, status: "waiting_approval" });
      await query(`UPDATE service_requests SET selected_technician_id = $1, agreed_price = '300' WHERE id = ANY($2::int[])`, [tech.id, [req1Id, req2Id]]);

      await makeOffer({ requestId: req1Id, technicianId: tech.id, price: "300", reservedPoints: 15, status: "selected" });
      await makeOffer({ requestId: req2Id, technicianId: tech.id, price: "300", reservedPoints: 15, status: "selected" });

      const [r1, r2] = await Promise.all([
        apiCall("POST", `/api/requests/${req1Id}/complete`, {}, cust1.token),
        apiCall("POST", `/api/requests/${req2Id}/complete`, {}, cust2.token),
      ]);
      await new Promise(r => setTimeout(r, 600)); // let secondary ops (points deduction) finish

      ok("T3.1 – both completions HTTP 200", r1.status === 200 && r2.status === 200, `got [${r1.status}, ${r2.status}]`);

      const [profile] = await query(`SELECT points_balance, reserved_points FROM technician_profiles WHERE id = $1`, [tech.profileId]);
      // Started at 100/30, both requests deduct 15 from balance and 15 from reserved → 70/0
      ok("T3.2 – points_balance reflects BOTH deductions (100 - 15 - 15 = 70)", Number(profile.points_balance) === 70, `got ${profile.points_balance}`);
      ok("T3.3 – reserved_points fully released (30 - 15 - 15 = 0)", Number(profile.reserved_points) === 0, `got ${profile.reserved_points}`);

      const commissionTxns = await query(
        `SELECT amount FROM point_transactions WHERE technician_id = $1 AND type = 'commission' AND request_id = ANY($2::int[])`,
        [tech.profileId, [req1Id, req2Id]]
      );
      ok("T3.4 – exactly two commission transactions logged", commissionTxns.length === 2, `got ${commissionTxns.length}`);
      const totalDeducted = commissionTxns.reduce((sum, t) => sum + Number(t.amount), 0);
      ok("T3.5 – total deducted across txns = 30", totalDeducted === 30, `got ${totalDeducted}`);
    } finally {
      await cleanup([cust1.mobile, cust2.mobile, tech.mobile]);
    }
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
