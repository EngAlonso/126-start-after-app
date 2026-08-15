#!/usr/bin/env node
/**
 * Phase 4 Functional Tests — Loyalty Redemption API
 *
 * Tests (29 total):
 *   T01–T08  POST /api/loyalty/calculate
 *   T09–T24  POST /api/loyalty/redeem
 *   T25–T29  DELETE /api/loyalty/redeem/:requestId
 *
 * Run: node scripts/phase4-functional-tests.mjs
 * Requires: DATABASE_URL env var; API server running on port 8080.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Pool } = require(
  "/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js"
);
import { createHmac } from "crypto";

// ── Config ───────────────────────────────────────────────────────────────────

const BASE    = "http://localhost:8080/api";
const JWT_SECRET = process.env.SESSION_SECRET || "fnashha-secret-key-2024";
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Minimal JWT signer (no external dep) ─────────────────────────────────────

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeToken(payload) {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig     = b64url(
    createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function api(method, path, body, token) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    results.push(`  ✓ ${name}`);
  } else {
    failed++;
    results.push(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

function expectStatus(name, got, expected) {
  check(name, got === expected, `expected HTTP ${expected}, got ${got}`);
}

function expectVal(name, got, expected) {
  check(name, got === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
}

// ── CMS helpers ───────────────────────────────────────────────────────────────

async function setCms(key, value) {
  await q(
    `INSERT INTO cms_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup() {
  // Remove coin_redemptions first (FK → service_requests + users)
  await q(`DELETE FROM coin_redemptions WHERE user_id IN (
    SELECT id FROM users WHERE mobile LIKE '099TEST%'
  )`);
  // coin_transactions
  await q(`DELETE FROM coin_transactions WHERE user_id IN (
    SELECT id FROM users WHERE mobile LIKE '099TEST%'
  )`);
  // customer_wallets
  await q(`DELETE FROM customer_wallets WHERE user_id IN (
    SELECT id FROM users WHERE mobile LIKE '099TEST%'
  )`);
  // service_requests
  await q(`DELETE FROM service_requests WHERE description LIKE 'TEST_PHASE4_%'`);
  // users
  await q(`DELETE FROM users WHERE mobile LIKE '099TEST%'`);
  // Restore loyalty to disabled
  await setCms("loyaltyEnabled", "false");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n=== Phase 4 Functional Tests — Loyalty Redemption API ===\n");

  // ── Pre-test cleanup (remove stale test data from any prior run) ──────────
  await cleanup();

  // ── Baseline CMS config ───────────────────────────────────────────────────
  // coinConversionRatio=1 → 1 coin = 1 EGP, easy math
  // maxCoinsPerRequest=200
  // minRequestValue=50
  await setCms("loyaltyEnabled", "true");
  await setCms("coinConversionRatio", "1");
  await setCms("maxCoinsPerRequest", "200");
  await setCms("minRequestValue", "50");

  // ── Create test users ─────────────────────────────────────────────────────

  // Customer A — main test customer
  const [custA] = await q(`
    INSERT INTO users (full_name, mobile, password_hash, role, status, referral_code)
    VALUES ('Test Customer A', '099TEST001', 'x', 'customer', 'active', 'TESTA001')
    RETURNING id
  `);
  const custAId    = custA.id;
  const custAToken = makeToken({ id: custAId, role: "customer", mobile: "099TEST001" });

  // Customer B — for ownership-check tests
  const [custB] = await q(`
    INSERT INTO users (full_name, mobile, password_hash, role, status, referral_code)
    VALUES ('Test Customer B', '099TEST002', 'x', 'customer', 'active', 'TESTB002')
    RETURNING id
  `);
  const custBId    = custB.id;
  const custBToken = makeToken({ id: custBId, role: "customer", mobile: "099TEST002" });

  // Customer C — no wallet (for wallet-missing test)
  const [custC] = await q(`
    INSERT INTO users (full_name, mobile, password_hash, role, status, referral_code)
    VALUES ('Test Customer C', '099TEST003', 'x', 'customer', 'active', 'TESTC003')
    RETURNING id
  `);
  const custCId    = custC.id;
  const custCToken = makeToken({ id: custCId, role: "customer", mobile: "099TEST003" });

  // Technician (needed for selectedTechnicianId FK)
  const [tech] = await q(`
    INSERT INTO users (full_name, mobile, password_hash, role, status, referral_code)
    VALUES ('Test Tech', '099TEST099', 'x', 'technician', 'active', 'TESTTECH9')
    RETURNING id
  `);
  const techId = tech.id;

  // ── Seed wallets ──────────────────────────────────────────────────────────
  // A: 300 coins available; B: 50 coins; C: no wallet
  await q(`INSERT INTO customer_wallets (user_id, coins_balance) VALUES ($1, 300)`, [custAId]);
  await q(`INSERT INTO customer_wallets (user_id, coins_balance) VALUES ($1, 50)`,  [custBId]);
  // C intentionally has no wallet

  // ── Create test service requests ──────────────────────────────────────────
  // Helper to insert an SR
  async function makeSR(customerId, overrides = {}) {
    const defaults = {
      customer_id: customerId,
      service_id: 1,
      selected_technician_id: techId,
      status: "in_progress",
      full_name: "Test",
      mobile: "099TEST001",
      governorate_id: 1,
      area_id: 1,
      address: "Test Address",
      description: overrides.description || "TEST_PHASE4_GENERIC",
      images: [],
      agreed_price: 100,
      has_discount: false,
      ...overrides,
    };
    const keys   = Object.keys(defaults);
    const vals   = Object.values(defaults);
    const places = keys.map((_, i) => `$${i + 1}`).join(", ");
    const cols   = keys.map(k => k).join(", ");
    const [row]  = await q(
      `INSERT INTO service_requests (${cols}) VALUES (${places}) RETURNING id`,
      vals
    );
    return row.id;
  }

  // R1: valid ready request — agreedPrice=100, technician selected, no discount
  const r1Id = await makeSR(custAId, { description: "TEST_PHASE4_R1" });

  // R2: no technician selected
  const r2Id = await makeSR(custAId, {
    description: "TEST_PHASE4_R2",
    selected_technician_id: null,
    status: "pending",
  });

  // R3: no agreedPrice
  const r3Id = await makeSR(custAId, {
    description: "TEST_PHASE4_R3",
    agreed_price: null,
    status: "pending",
  });

  // R4: agreedPrice=30 < minRequestValue=50
  const r4Id = await makeSR(custAId, { description: "TEST_PHASE4_R4", agreed_price: 30 });

  // R5: has_discount=true, no active coin_redemption (represents coupon/other discount)
  const r5Id = await makeSR(custAId, { description: "TEST_PHASE4_R5", has_discount: true });

  // R6: owned by Customer B
  const r6Id = await makeSR(custBId, { description: "TEST_PHASE4_R6" });

  // R7: for successful redemption — agreedPrice=100; will use 60 coins
  const r7Id = await makeSR(custAId, { description: "TEST_PHASE4_R7" });

  // R8: for price-cap test — agreedPrice=80; ratio=1 → maxFromPrice=80
  //     wallet has 300, will request 150 → coinsToReserve = min(150,80) = 80
  const r8Id = await makeSR(custAId, { description: "TEST_PHASE4_R8", agreed_price: 80 });

  // R9: owned by Customer C (no wallet)
  const r9Id = await makeSR(custCId, { description: "TEST_PHASE4_R9" });

  // R10: pre-seeded with an active coin redemption for release tests
  //      agreedPrice=100; 50 coins reserved
  const r10Id = await makeSR(custAId, {
    description: "TEST_PHASE4_R10",
    has_discount: true,
    customer_payable_amount: 50,
  });
  await q(`INSERT INTO coin_redemptions (request_id, user_id, coins_redeemed, discount_value, status)
           VALUES ($1, $2, 50, '50', 'active')`, [r10Id, custAId]);
  // Adjust wallet to reflect the reservation
  await q(`UPDATE customer_wallets SET coins_balance=250, reserved_coins=50 WHERE user_id=$1`, [custAId]);

  // R11: for "duplicate redemption" test — has active coin redemption
  const r11Id = await makeSR(custAId, {
    description: "TEST_PHASE4_R11",
    has_discount: true,
    customer_payable_amount: 70,
  });
  await q(`INSERT INTO coin_redemptions (request_id, user_id, coins_redeemed, discount_value, status)
           VALUES ($1, $2, 30, '30', 'active')`, [r11Id, custAId]);

  // ── TEST GROUP 1: POST /loyalty/calculate ─────────────────────────────────

  console.log("--- POST /loyalty/calculate ---");

  // T01: Missing coinsToUse → 400
  {
    const r = await api("POST", "/loyalty/calculate", {}, custAToken);
    expectStatus("T01 — missing coinsToUse → 400", r.status, 400);
  }

  // T02: Negative coinsToUse → 400
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: -5 }, custAToken);
    expectStatus("T02 — negative coinsToUse → 400", r.status, 400);
  }

  // T03: Non-integer coinsToUse → 400
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: 1.5 }, custAToken);
    expectStatus("T03 — non-integer coinsToUse → 400", r.status, 400);
  }

  // T04: coinsToUse=0, no requestId → 200 with allowedCoins=0
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: 0 }, custAToken);
    expectStatus("T04 — coinsToUse=0, no requestId → 200", r.status, 200);
    expectVal   ("T04 — allowedCoins=0", r.data.allowedCoins, 0);
  }

  // T05: Valid calculate with requestId (owned by user) → 200 with customerPayableAmount
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: 50, requestId: r1Id }, custAToken);
    expectStatus("T05 — calculate with owned requestId → 200", r.status, 200);
    check       ("T05 — customerPayableAmount is a number", typeof r.data.customerPayableAmount === "number",
                 `got ${typeof r.data.customerPayableAmount} (${JSON.stringify(r.data.customerPayableAmount)})`);
  }

  // T06: requestId owned by another user → 403
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: 50, requestId: r6Id }, custAToken);
    expectStatus("T06 — calculate with other user's requestId → 403", r.status, 403);
  }

  // T07: Non-existent requestId → 404
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: 50, requestId: 9999999 }, custAToken);
    expectStatus("T07 — calculate with non-existent requestId → 404", r.status, 404);
  }

  // T08: Price cap in calculate — coinsToUse=150, agreedPrice=80, ratio=1 → allowedCoins=80
  //      wallet.coinsBalance=250, maxCoinsPerRequest=200, maxFromPrice=80
  //      effective cap = min(200, 250, 80) = 80  →  allowedCoins = min(150, 80) = 80
  {
    const r = await api("POST", "/loyalty/calculate", { coinsToUse: 150, requestId: r8Id }, custAToken);
    expectStatus("T08 — calculate price-cap → 200", r.status, 200);
    expectVal   ("T08 — allowedCoins capped to agreedPrice/ratio = 80", r.data.allowedCoins, 80);
    expectVal   ("T08 — customerPayableAmount = 80 − 80 = 0", r.data.customerPayableAmount, 0);
  }

  // ── TEST GROUP 2: POST /loyalty/redeem ────────────────────────────────────

  console.log("\n--- POST /loyalty/redeem ---");

  // Reset wallet A to known state before this group
  // (coins_balance=250, reserved_coins=50 from r10 + r11 reservations)
  // r10 has 50 reserved, r11 has 30 reserved → total reserved = 80
  await q(`UPDATE customer_wallets SET coins_balance=250, reserved_coins=80 WHERE user_id=$1`, [custAId]);

  // T09: Missing requestId → 400
  {
    const r = await api("POST", "/loyalty/redeem", { coinsToUse: 50 }, custAToken);
    expectStatus("T09 — missing requestId → 400", r.status, 400);
  }

  // T10: Missing coinsToUse → 400
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r1Id }, custAToken);
    expectStatus("T10 — missing coinsToUse → 400", r.status, 400);
  }

  // T11: coinsToUse=0 (must be positive integer) → 400
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r1Id, coinsToUse: 0 }, custAToken);
    expectStatus("T11 — coinsToUse=0 → 400", r.status, 400);
  }

  // T12: Loyalty disabled → 403
  {
    await setCms("loyaltyEnabled", "false");
    const r = await api("POST", "/loyalty/redeem", { requestId: r1Id, coinsToUse: 50 }, custAToken);
    expectStatus("T12 — loyalty disabled → 403", r.status, 403);
    await setCms("loyaltyEnabled", "true");  // restore
  }

  // T13: Non-existent request → 404
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: 9999999, coinsToUse: 50 }, custAToken);
    expectStatus("T13 — non-existent request → 404", r.status, 404);
  }

  // T14: Request owned by another user → 403
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r6Id, coinsToUse: 50 }, custAToken);
    expectStatus("T14 — request owned by another user → 403", r.status, 403);
  }

  // T15: No technician selected → 409
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r2Id, coinsToUse: 50 }, custAToken);
    expectStatus("T15 — no technician selected → 409", r.status, 409);
  }

  // T16: No agreedPrice → 409
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r3Id, coinsToUse: 50 }, custAToken);
    expectStatus("T16 — no agreedPrice → 409", r.status, 409);
  }

  // T17: agreedPrice below minRequestValue (30 < 50) → 409
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r4Id, coinsToUse: 20 }, custAToken);
    expectStatus("T17 — agreedPrice below minRequestValue → 409", r.status, 409);
  }

  // T18: has_discount=true, no active coin redemption (other discount type) → 409
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r5Id, coinsToUse: 50 }, custAToken);
    expectStatus("T18 — other discount applied → 409", r.status, 409);
  }

  // T19: Existing active coin redemption → 409 "already reserved"
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r11Id, coinsToUse: 30 }, custAToken);
    expectStatus("T19 — existing active coin redemption → 409", r.status, 409);
  }

  // T20: Customer with no wallet → 409
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r9Id, coinsToUse: 50 }, custCToken);
    expectStatus("T20 — no wallet → 409", r.status, 409);
  }

  // T21: Insufficient balance → 409
  //      Temporarily set balance to 10 coins, request 60
  {
    await q(`UPDATE customer_wallets SET coins_balance=10 WHERE user_id=$1`, [custAId]);
    const r = await api("POST", "/loyalty/redeem", { requestId: r1Id, coinsToUse: 60 }, custAToken);
    expectStatus("T21 — insufficient balance → 409", r.status, 409);
    await q(`UPDATE customer_wallets SET coins_balance=250 WHERE user_id=$1`, [custAId]);  // restore
  }

  // T22: coinsToUse > maxCoinsPerRequest (250 > 200) → 409
  //      wallet.coinsBalance=250, so balance check passes, but policy check fires first
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r1Id, coinsToUse: 250 }, custAToken);
    expectStatus("T22 — coinsToUse > maxCoinsPerRequest → 409", r.status, 409);
  }

  // T23 (THE FIXED TEST): Price cap — coinsToUse > maxFromPrice → 201, coinsReserved = maxFromPrice
  //
  //  Config:    coinConversionRatio=1, maxCoinsPerRequest=200, minRequestValue=50
  //  Request:   r8Id, agreedPrice=80 → maxFromPrice = floor(80/1) = 80
  //  Wallet:    coins_balance=250 (≥ 150 = coinsToUse) ✓ balance check passes
  //  Policy:    coinsToUse=150 ≤ maxCoinsPerRequest=200  ✓ policy check passes
  //  Price cap: coinsToReserve = min(150, 80) = 80       → silent cap applied
  //  Expected:  201, coinsReserved=80, discountValue=80, customerPayableAmount=0
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r8Id, coinsToUse: 150 }, custAToken);
    expectStatus("T23 — price-cap: 201 response", r.status, 201);
    expectVal   ("T23 — coinsReserved capped to maxFromPrice=80", r.data.coinsReserved, 80);
    expectVal   ("T23 — discountValue=80 (80 coins × ratio=1)", r.data.discountValue, 80);
    expectVal   ("T23 — customerPayableAmount=0 (80−80)", r.data.customerPayableAmount, 0);
    // Verify request state updated
    const [reqRow] = await q(`SELECT has_discount, customer_payable_amount FROM service_requests WHERE id=$1`, [r8Id]);
    check("T23 — request.has_discount=true", reqRow.has_discount === true,
          `has_discount=${reqRow.has_discount}`);
    // Reverse r8 redemption so later tests can use wallet cleanly
    await q(`UPDATE coin_redemptions SET status='reversed' WHERE request_id=$1 AND status='active'`, [r8Id]);
    await q(`UPDATE service_requests SET has_discount=false, customer_payable_amount=NULL WHERE id=$1`, [r8Id]);
    await q(`UPDATE customer_wallets SET coins_balance=250, reserved_coins=80 WHERE user_id=$1`, [custAId]);
  }

  // T24: Successful redemption → 201, correct wallet and request state
  //      coinsToUse=60, agreedPrice=100, ratio=1 → coinsToReserve=60, discountValue=60, payable=40
  {
    const r = await api("POST", "/loyalty/redeem", { requestId: r7Id, coinsToUse: 60 }, custAToken);
    expectStatus("T24 — successful redemption → 201", r.status, 201);
    expectVal   ("T24 — coinsReserved=60", r.data.coinsReserved, 60);
    expectVal   ("T24 — discountValue=60", r.data.discountValue, 60);
    expectVal   ("T24 — customerPayableAmount=40 (100−60)", r.data.customerPayableAmount, 40);

    // Verify wallet state: coinsBalance should drop by 60
    const [w] = await q(`SELECT coins_balance, reserved_coins FROM customer_wallets WHERE user_id=$1`, [custAId]);
    expectVal("T24 — wallet.coins_balance=190 (250−60)", w.coins_balance, 190);

    // Verify request stamped with discount
    const [req] = await q(`SELECT has_discount, customer_payable_amount FROM service_requests WHERE id=$1`, [r7Id]);
    check("T24 — request.has_discount=true", req.has_discount === true,
          `has_discount=${req.has_discount}`);
    expectVal("T24 — request.customer_payable_amount='40.00'", req.customer_payable_amount, "40.00");
  }

  // ── TEST GROUP 3: DELETE /loyalty/redeem/:requestId ───────────────────────

  console.log("\n--- DELETE /loyalty/redeem/:requestId ---");

  // T25: Invalid requestId param (non-numeric) → 400
  {
    const r = await api("DELETE", "/loyalty/redeem/abc", undefined, custAToken);
    expectStatus("T25 — invalid requestId param → 400", r.status, 400);
  }

  // T26: Non-existent requestId → 404
  {
    const r = await api("DELETE", "/loyalty/redeem/9999999", undefined, custAToken);
    expectStatus("T26 — non-existent requestId → 404", r.status, 404);
  }

  // T27: Request owned by another user → 403
  {
    const r = await api("DELETE", `/loyalty/redeem/${r6Id}`, undefined, custAToken);
    expectStatus("T27 — release on another user's request → 403", r.status, 403);
  }

  // T28: No active redemption on request → 409
  //      r1 has no coin_redemptions row
  {
    const r = await api("DELETE", `/loyalty/redeem/${r1Id}`, undefined, custAToken);
    expectStatus("T28 — no active redemption → 409", r.status, 409);
  }

  // T29: Successful release → 200, coins returned to wallet
  //      r10 has 50 coins reserved; wallet before: coins_balance=190, reserved_coins=140 (80+60)
  {
    const [wBefore] = await q(`SELECT coins_balance, reserved_coins FROM customer_wallets WHERE user_id=$1`, [custAId]);
    const r = await api("DELETE", `/loyalty/redeem/${r10Id}`, undefined, custAToken);
    expectStatus("T29 — successful release → 200", r.status, 200);
    expectVal   ("T29 — coinsReleased=50", r.data.coinsReleased, 50);

    // Wallet: coins_balance += 50, reserved_coins -= 50
    const [wAfter] = await q(`SELECT coins_balance, reserved_coins FROM customer_wallets WHERE user_id=$1`, [custAId]);
    expectVal("T29 — wallet.coins_balance restored (+50)",
              wAfter.coins_balance, wBefore.coins_balance + 50);
    expectVal("T29 — wallet.reserved_coins decreased (−50)",
              wAfter.reserved_coins, Math.max(0, wBefore.reserved_coins - 50));

    // Verify redemption marked reversed
    const [red] = await q(`SELECT status FROM coin_redemptions WHERE request_id=$1`, [r10Id]);
    expectVal("T29 — redemption status='reversed'", red.status, "reversed");

    // Verify request reset to no-discount state
    const [req] = await q(`SELECT has_discount FROM service_requests WHERE id=$1`, [r10Id]);
    check("T29 — request.has_discount reset to false", req.has_discount === false,
          `has_discount=${req.has_discount}`);
  }

  // ── Final cleanup ─────────────────────────────────────────────────────────
  await cleanup();
  await pool.end();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== Results ===");
  results.forEach(r => console.log(r));
  console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(failed === 0 ? "\n✓ All tests passed." : `\n✗ ${failed} test(s) failed.`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error("\nFatal error:", err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});
