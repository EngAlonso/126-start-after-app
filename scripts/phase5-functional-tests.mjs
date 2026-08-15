/**
 * Phase 5 Functional Tests — Customer Wallet APIs
 *
 * Tests:
 *   GET /api/loyalty/wallet
 *   GET /api/loyalty/transactions
 *   GET /api/loyalty/referral-code
 *
 * Run: node scripts/phase5-functional-tests.mjs
 */

import { createHmac, createHash } from "node:crypto";

const API = "http://localhost:8080/api";
const PG_PATH = "/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";

// ─── Minimal JWT signer ────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";
function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}
function makeJwt(payload) {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig     = b64url(createHmac("sha256", SESSION_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function authHeader(userId, role) {
  return { Authorization: `Bearer ${makeJwt({ id: userId, role })}` };
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
async function get(path, headers = {}) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...headers } });
  let body;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

// ─── Assertion helpers ─────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function expectStatus(label, got, want) {
  if (got === want) { console.log(`  ✅  ${label}`); passed++; }
  else              { console.error(`  ❌  ${label} — expected status ${want}, got ${got}`); failed++; }
}
function expectField(label, body, field, want) {
  const got = body?.[field];
  if (got === want) { console.log(`  ✅  ${label}`); passed++; }
  else              { console.error(`  ❌  ${label} — expected ${field}=${JSON.stringify(want)}, got ${JSON.stringify(got)}`); failed++; }
}
function expectNumField(label, body, field, want) {
  const got = body?.[field];
  if (typeof got === "number" && got === want) { console.log(`  ✅  ${label}`); passed++; }
  else { console.error(`  ❌  ${label} — expected ${field}=${want} (number), got ${JSON.stringify(got)}`); failed++; }
}
function expectHasField(label, body, field) {
  if (field in (body ?? {})) { console.log(`  ✅  ${label}`); passed++; }
  else { console.error(`  ❌  ${label} — field "${field}" missing from ${JSON.stringify(body)}`); failed++; }
}
function expectTruthy(label, val) {
  if (val) { console.log(`  ✅  ${label}`); passed++; }
  else      { console.error(`  ❌  ${label} — expected truthy, got ${JSON.stringify(val)}`); failed++; }
}

// ─── DB helper ────────────────────────────────────────────────────────────────
const { default: pg } = await import(PG_PATH);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function q(sql, params = []) { const r = await pool.query(sql, params); return r.rows; }

// ─── Test data ────────────────────────────────────────────────────────────────
let custAId, custBId, custCId, adminId, techId;
let refCodeA;

async function seed() {
  // Cleanup (by unique mobile prefix)
  await q(`DELETE FROM coin_transactions WHERE wallet_id IN (
    SELECT id FROM customer_wallets WHERE user_id IN (
      SELECT id FROM users WHERE mobile LIKE '0100000001%'
    )
  )`);
  await q(`DELETE FROM customer_wallets WHERE user_id IN (SELECT id FROM users WHERE mobile LIKE '0100000001%')`);
  await q(`DELETE FROM service_requests WHERE customer_id IN (SELECT id FROM users WHERE mobile LIKE '0100000001%')`);
  await q(`DELETE FROM referrals WHERE referrer_id IN (SELECT id FROM users WHERE mobile LIKE '0100000001%') OR
                                       referee_id  IN (SELECT id FROM users WHERE mobile LIKE '0100000001%')`);
  await q(`DELETE FROM users WHERE mobile LIKE '0100000001%'`);

  // Insert users (schema uses full_name / mobile, email nullable)
  const [a] = await q(
    `INSERT INTO users (full_name, mobile, password_hash, role, referral_code) VALUES ('P5 CustA','01000000011','x','customer','P5REFA') RETURNING id`
  );
  const [b] = await q(
    `INSERT INTO users (full_name, mobile, password_hash, role, referral_code) VALUES ('P5 CustB','01000000012','x','customer','P5REFB') RETURNING id`
  );
  const [c] = await q(
    `INSERT INTO users (full_name, mobile, password_hash, role, referral_code) VALUES ('P5 CustC','01000000013','x','customer','P5REFC') RETURNING id`
  );
  const [adm] = await q(
    `INSERT INTO users (full_name, mobile, password_hash, role) VALUES ('P5 Admin','01000000014','x','admin') RETURNING id`
  );
  const [tech] = await q(
    `INSERT INTO users (full_name, mobile, password_hash, role) VALUES ('P5 Tech','01000000015','x','technician') RETURNING id`
  );
  custAId = a.id; custBId = b.id; custCId = c.id; adminId = adm.id; techId = tech.id;
  refCodeA = "P5REFA";

  // Seed wallet for A: 150 available, 30 reserved, 20 pending, 500 lifetime earned, 200 lifetime used
  await q(
    `INSERT INTO customer_wallets (user_id, coins_balance, reserved_coins, pending_coins, lifetime_earned, lifetime_used)
     VALUES ($1, 150, 30, 20, 500, 200)`,
    [custAId]
  );
  // B: default empty wallet (will be seeded by engine on registration path — we do it manually)
  await q(`INSERT INTO customer_wallets (user_id) VALUES ($1)`, [custBId]);
  // C: no wallet at all (intentionally omitted)

  // Insert coin transactions for A's wallet
  const [walA] = await q(`SELECT id FROM customer_wallets WHERE user_id=$1`, [custAId]);
  const walletAId = walA.id;
  await q(
    `INSERT INTO coin_transactions (wallet_id, user_id, amount, type, balance_after, source_type, source_id, description)
     VALUES
       ($1, $2, 200, 'earn_available', 200, 'registration', NULL, 'مكافأة التسجيل'),
       ($1, $2, 300, 'referral_bonus', 500, 'referral',      1,   'مكافأة الإحالة'),
       ($1, $2, 200, 'redeem',         300, 'redemption',    5,   'استخدام كوينز')`,
    [walletAId, custAId]
  );

  // Referrals for A: 2 pending, 1 completed
  // referrals.referee_id is UNIQUE, so use B for one and C for two separate records isn't possible.
  // Instead: B→pending, C→completed. That gives 1 pending + 1 completed = 2 total.
  // We also need a third user to hit total=3 if we want 2 pending. Use a workaround:
  // Insert a 4th test user D for the second pending referral.
  const [d] = await q(
    `INSERT INTO users (full_name, mobile, password_hash, role, referral_code) VALUES ('P5 CustD','01000000016','x','customer','P5REFD') RETURNING id`
  );
  await q(
    `INSERT INTO referrals (referrer_id, referee_id, referral_code, status) VALUES
       ($1, $2, 'P5REFA', 'pending'),
       ($1, $3, 'P5REFA', 'pending'),
       ($1, $4, 'P5REFA', 'completed')`,
    [custAId, custBId, custCId, d.id]
  );

  // Override CMS loyalty settings
  await q(`UPDATE cms_settings SET value='true'  WHERE key='loyaltyEnabled'`);
  await q(`UPDATE cms_settings SET value='1'     WHERE key='coinConversionRatio'`);

  console.log(`Seed complete. custA=${custAId}, custB=${custBId}, custC=${custCId}, admin=${adminId}, tech=${techId}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST GROUPS
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /loyalty/wallet ──────────────────────────────────────────────────────
async function testWallet() {
  console.log("\n── GET /loyalty/wallet ──────────────────────────────────────────────");

  // T01: Anonymous → 401
  {
    const r = await get("/loyalty/wallet");
    expectStatus("T01 — anon → 401", r.status, 401);
  }

  // T02: Admin → 403
  {
    const r = await get("/loyalty/wallet", authHeader(adminId, "admin"));
    expectStatus("T02 — admin → 403", r.status, 403);
  }

  // T03: Technician → 403
  {
    const r = await get("/loyalty/wallet", authHeader(techId, "technician"));
    expectStatus("T03 — technician → 403", r.status, 403);
  }

  // T04: Customer with no wallet → 200, all zeros
  {
    const r = await get("/loyalty/wallet", authHeader(custCId, "customer"));
    expectStatus("T04 — no wallet → 200", r.status, 200);
    expectNumField("T04 — availableCoins=0",  r.body, "availableCoins",  0);
    expectNumField("T04 — pendingCoins=0",    r.body, "pendingCoins",    0);
    expectNumField("T04 — reservedCoins=0",   r.body, "reservedCoins",   0);
    expectNumField("T04 — lifetimeEarned=0",  r.body, "lifetimeEarned",  0);
    expectNumField("T04 — lifetimeUsed=0",    r.body, "lifetimeUsed",    0);
    expectNumField("T04 — approximateDiscountValue=0", r.body, "approximateDiscountValue", 0);
  }

  // T05: Customer A with wallet → correct balances
  {
    const r = await get("/loyalty/wallet", authHeader(custAId, "customer"));
    expectStatus("T05 — wallet owner → 200", r.status, 200);
    expectNumField("T05 — availableCoins=150",        r.body, "availableCoins",           150);
    expectNumField("T05 — pendingCoins=20",           r.body, "pendingCoins",             20);
    expectNumField("T05 — reservedCoins=30",          r.body, "reservedCoins",            30);
    expectNumField("T05 — lifetimeEarned=500",        r.body, "lifetimeEarned",           500);
    expectNumField("T05 — lifetimeUsed=200",          r.body, "lifetimeUsed",             200);
    // ratio=1 → discount = 150 * 1 = 150
    expectNumField("T05 — approximateDiscountValue=150", r.body, "approximateDiscountValue", 150);
  }

  // T06: approximateDiscountValue uses CMS ratio (not hardcoded)
  {
    // Set ratio to 0.5, check discount = 150 * 0.5 = 75
    await q(`UPDATE cms_settings SET value='0.5' WHERE key='coinConversionRatio'`);
    const r = await get("/loyalty/wallet", authHeader(custAId, "customer"));
    expectStatus("T06 — ratio change → 200", r.status, 200);
    expectNumField("T06 — approximateDiscountValue=75 (150×0.5)", r.body, "approximateDiscountValue", 75);
    // Restore ratio
    await q(`UPDATE cms_settings SET value='1' WHERE key='coinConversionRatio'`);
  }

  // T07: Response has coinName / coinNameEn / coinConversionRatio from CMS
  {
    const r = await get("/loyalty/wallet", authHeader(custAId, "customer"));
    expectHasField("T07 — coinName present",           r.body, "coinName");
    expectHasField("T07 — coinNameEn present",         r.body, "coinNameEn");
    expectHasField("T07 — coinConversionRatio present", r.body, "coinConversionRatio");
  }

  // T08: Wallet does NOT write to DB (balance unchanged after GET)
  {
    const [before] = await q(`SELECT coins_balance FROM customer_wallets WHERE user_id=$1`, [custAId]);
    await get("/loyalty/wallet", authHeader(custAId, "customer"));
    const [after]  = await q(`SELECT coins_balance FROM customer_wallets WHERE user_id=$1`, [custAId]);
    const label = "T08 — GET /wallet is read-only (balance unchanged)";
    if (before.coins_balance === after.coins_balance) { console.log(`  ✅  ${label}`); passed++; }
    else { console.error(`  ❌  ${label}`); failed++; }
  }
}

// ─── GET /loyalty/transactions ────────────────────────────────────────────────
async function testTransactions() {
  console.log("\n── GET /loyalty/transactions ─────────────────────────────────────────");

  // T09: Anonymous → 401
  {
    const r = await get("/loyalty/transactions");
    expectStatus("T09 — anon → 401", r.status, 401);
  }

  // T10: Admin → 403
  {
    const r = await get("/loyalty/transactions", authHeader(adminId, "admin"));
    expectStatus("T10 — admin → 403", r.status, 403);
  }

  // T11: Technician → 403
  {
    const r = await get("/loyalty/transactions", authHeader(techId, "technician"));
    expectStatus("T11 — technician → 403", r.status, 403);
  }

  // T12: Customer with no wallet → 200, empty list
  {
    const r = await get("/loyalty/transactions", authHeader(custCId, "customer"));
    expectStatus("T12 — no wallet → 200", r.status, 200);
    const txs12 = r.body?.transactions;
    const isEmpty = Array.isArray(txs12) && txs12.length === 0;
    if (isEmpty) { console.log("  ✅  T12 — transactions=[]"); passed++; }
    else { console.error(`  ❌  T12 — expected empty array, got ${JSON.stringify(txs12)}`); failed++; }
    expectNumField("T12 — total=0",       r.body, "total",        0);
    expectNumField("T12 — page=1",        r.body, "page",         1);
    expectNumField("T12 — totalPages=0",  r.body, "totalPages",   0);
  }

  // T13: Customer A → 200, 3 transactions (we seeded 3)
  {
    const r = await get("/loyalty/transactions", authHeader(custAId, "customer"));
    expectStatus("T13 — wallet owner → 200", r.status, 200);
    expectNumField("T13 — total=3",           r.body, "total",      3);
    expectNumField("T13 — page=1",            r.body, "page",       1);
    expectNumField("T13 — totalPages=1",      r.body, "totalPages", 1);
    const txs = r.body?.transactions ?? [];
    const hasAll = txs.length === 3;
    if (hasAll) { console.log("  ✅  T13 — 3 transactions returned"); passed++; }
    else        { console.error(`  ❌  T13 — expected 3 transactions, got ${txs.length}`); failed++; }
  }

  // T14: Each transaction has required fields
  {
    const r = await get("/loyalty/transactions", authHeader(custAId, "customer"));
    const tx = r.body?.transactions?.[0];
    const required = ["id", "type", "amount", "balanceAfter", "sourceType", "sourceId", "description", "createdAt"];
    for (const f of required) {
      expectHasField(`T14 — tx has field "${f}"`, tx, f);
    }
  }

  // T15: Pagination — limit=2 on page 1 → 2 rows, totalPages=2
  {
    const r = await get("/loyalty/transactions?page=1&limit=2", authHeader(custAId, "customer"));
    expectStatus("T15 — pagination → 200", r.status, 200);
    const txs = r.body?.transactions ?? [];
    if (txs.length === 2) { console.log("  ✅  T15 — limit=2 returns 2 transactions"); passed++; }
    else { console.error(`  ❌  T15 — expected 2 transactions, got ${txs.length}`); failed++; }
    expectNumField("T15 — totalPages=2", r.body, "totalPages", 2);
    expectNumField("T15 — total=3",      r.body, "total",      3);
  }

  // T16: Pagination — page=2, limit=2 → 1 row
  {
    const r = await get("/loyalty/transactions?page=2&limit=2", authHeader(custAId, "customer"));
    expectStatus("T16 — page 2 → 200", r.status, 200);
    const txs = r.body?.transactions ?? [];
    if (txs.length === 1) { console.log("  ✅  T16 — page 2 returns 1 transaction"); passed++; }
    else { console.error(`  ❌  T16 — expected 1 transaction on page 2, got ${txs.length}`); failed++; }
  }

  // T17: Ordered newest first (desc)
  {
    const r = await get("/loyalty/transactions", authHeader(custAId, "customer"));
    const txs = r.body?.transactions ?? [];
    if (txs.length >= 2) {
      const first  = new Date(txs[0].createdAt).getTime();
      const second = new Date(txs[1].createdAt).getTime();
      const ordered = first >= second;
      if (ordered) { console.log("  ✅  T17 — transactions ordered newest-first"); passed++; }
      else { console.error("  ❌  T17 — transactions not ordered newest-first"); failed++; }
    } else {
      console.log("  ⚠️  T17 — skipped (not enough transactions to check order)"); 
    }
  }

  // T18: Customer B only sees own transactions (zero from the seed)
  {
    const r = await get("/loyalty/transactions", authHeader(custBId, "customer"));
    expectStatus("T18 — custB → 200", r.status, 200);
    expectNumField("T18 — custB has 0 transactions", r.body, "total", 0);
  }

  // T19: Read-only — no DB writes on GET
  {
    const [before] = await q(`SELECT COUNT(*) AS n FROM coin_transactions`);
    await get("/loyalty/transactions", authHeader(custAId, "customer"));
    const [after]  = await q(`SELECT COUNT(*) AS n FROM coin_transactions`);
    const label = "T19 — GET /transactions is read-only";
    if (before.n === after.n) { console.log(`  ✅  ${label}`); passed++; }
    else { console.error(`  ❌  ${label}`); failed++; }
  }
}

// ─── GET /loyalty/referral-code ───────────────────────────────────────────────
async function testReferralCode() {
  console.log("\n── GET /loyalty/referral-code ────────────────────────────────────────");

  // T20: Anonymous → 401
  {
    const r = await get("/loyalty/referral-code");
    expectStatus("T20 — anon → 401", r.status, 401);
  }

  // T21: Admin → 403
  {
    const r = await get("/loyalty/referral-code", authHeader(adminId, "admin"));
    expectStatus("T21 — admin → 403", r.status, 403);
  }

  // T22: Technician → 403
  {
    const r = await get("/loyalty/referral-code", authHeader(techId, "technician"));
    expectStatus("T22 — technician → 403", r.status, 403);
  }

  // T23: Customer A → 200, correct referral code
  {
    const r = await get("/loyalty/referral-code", authHeader(custAId, "customer"));
    expectStatus("T23 — customer → 200", r.status, 200);
    expectField("T23 — referralCode=P5REFA", r.body, "referralCode", "P5REFA");
  }

  // T24: referralLink is present and contains the code
  {
    const r = await get("/loyalty/referral-code", authHeader(custAId, "customer"));
    const link = r.body?.referralLink ?? "";
    const hasCode = link.includes("P5REFA");
    if (hasCode) { console.log("  ✅  T24 — referralLink contains the code"); passed++; }
    else { console.error(`  ❌  T24 — referralLink missing code: ${link}`); failed++; }
  }

  // T25: statistics block has pending / completed / total
  {
    const r = await get("/loyalty/referral-code", authHeader(custAId, "customer"));
    expectStatus("T25 — statistics → 200", r.status, 200);
    expectHasField("T25 — statistics field present", r.body, "statistics");
    const stats = r.body?.statistics;
    expectHasField("T25 — statistics.pending",   stats, "pending");
    expectHasField("T25 — statistics.completed", stats, "completed");
    expectHasField("T25 — statistics.total",     stats, "total");
  }

  // T26: statistics values match seeded referrals (2 pending, 1 completed, 3 total)
  {
    const r = await get("/loyalty/referral-code", authHeader(custAId, "customer"));
    const s = r.body?.statistics;
    expectNumField("T26 — statistics.pending=2",   s, "pending",   2);
    expectNumField("T26 — statistics.completed=1", s, "completed", 1);
    expectNumField("T26 — statistics.total=3",     s, "total",     3);
  }

  // T27: Customer B has zero referrals
  {
    const r = await get("/loyalty/referral-code", authHeader(custBId, "customer"));
    expectStatus("T27 — custB → 200", r.status, 200);
    const s = r.body?.statistics;
    expectNumField("T27 — statistics.pending=0",   s, "pending",   0);
    expectNumField("T27 — statistics.completed=0", s, "completed", 0);
    expectNumField("T27 — statistics.total=0",     s, "total",     0);
  }

  // T28: "stats" key is NOT present (spec uses "statistics")
  {
    const r = await get("/loyalty/referral-code", authHeader(custAId, "customer"));
    const noOldKey = !("stats" in (r.body ?? {}));
    if (noOldKey) { console.log("  ✅  T28 — no legacy 'stats' key in response"); passed++; }
    else { console.error("  ❌  T28 — legacy 'stats' key still present"); failed++; }
  }

  // T29: Response is immutable — no DB writes
  {
    const [before] = await q(`SELECT referral_code FROM users WHERE id=$1`, [custAId]);
    await get("/loyalty/referral-code", authHeader(custAId, "customer"));
    const [after]  = await q(`SELECT referral_code FROM users WHERE id=$1`, [custAId]);
    const label = "T29 — GET /referral-code is read-only (code unchanged)";
    if (before.referral_code === after.referral_code) { console.log(`  ✅  ${label}`); passed++; }
    else { console.error(`  ❌  ${label}`); failed++; }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  await q(`DELETE FROM referrals WHERE referrer_id IN (SELECT id FROM users WHERE mobile LIKE '0100000001%') OR
                                       referee_id  IN (SELECT id FROM users WHERE mobile LIKE '0100000001%')`);
  await q(`DELETE FROM coin_transactions WHERE wallet_id IN (
    SELECT id FROM customer_wallets WHERE user_id IN (SELECT id FROM users WHERE mobile LIKE '0100000001%')
  )`);
  await q(`DELETE FROM customer_wallets WHERE user_id IN (SELECT id FROM users WHERE mobile LIKE '0100000001%')`);
  await q(`DELETE FROM users WHERE mobile LIKE '0100000001%'`);
  // Restore CMS
  await q(`UPDATE cms_settings SET value='true' WHERE key='loyaltyEnabled'`);
  await q(`UPDATE cms_settings SET value='0.1'  WHERE key='coinConversionRatio'`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
try {
  await seed();
  await testWallet();
  await testTransactions();
  await testReferralCode();
} finally {
  await cleanup();
  await pool.end();
}

console.log(`\n${"═".repeat(60)}`);
if (failed === 0) {
  console.log(`✅  ALL PASSED — ${passed}/${passed + failed} assertions`);
} else {
  console.log(`❌  ${failed} FAILED, ${passed} PASSED — ${passed}/${passed + failed} assertions`);
  process.exit(1);
}
