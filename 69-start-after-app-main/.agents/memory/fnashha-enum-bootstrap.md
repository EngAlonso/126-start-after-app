---
name: Fnashha enum bootstrap pattern
description: Rules for PG enum creation in bootstrap; single $ vs $$ dollar-quoting crash; ALTER TYPE must be separate calls.
---

# Fnashha Enum Bootstrap Pattern

## Rule 1 — Dollar-quoting in multi-statement queries
`DO` blocks inside a multi-statement `pool.query()` call **must** use double-dollar delimiters (`DO $$ BEGIN ... END $$;`).  Single-dollar (`DO $ BEGIN ... END $;`) is NOT valid PostgreSQL dollar-quoting syntax and causes `syntax error at or near "$"` (position ~1941 in the enumDDL string).

**Why:** This crashed the entire `enumDDL` call, leaving all tables uncreated. `tableDDL` and `loyaltyDDL` then also failed because `users` didn't exist — resulting in a completely empty database and a broken backup restore that errored with `relation "campaigns" does not exist`.

**How to apply:** All `DO` blocks in bootstrap.ts use `$$` — verify with `grep "DO \$[^$]" bootstrap.ts` returning zero results.

## Rule 2 — ALTER TYPE ADD VALUE must be a standalone call
`ALTER TYPE ... ADD VALUE IF NOT EXISTS` must run as a standalone `pool.query()` call in autocommit mode. It must NOT be wrapped in a `DO $$ BEGIN ... EXCEPTION ... END $$;` block (silently fails on pre-PG-12).

**How to apply:**
```js
// CORRECT
for (const stmt of ["ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted'"]) {
  try { await pool.query(stmt); } catch {}
}
// WRONG — silently eats the value on some PG versions
DO $$ BEGIN ALTER TYPE user_status ADD VALUE ...; EXCEPTION WHEN others THEN NULL; END $$;
```

## Rule 3 — Loyalty enums created redundantly
Loyalty enums (coin_tx_type, redemption_status, credit_status, referral_status, campaign_target) are currently created in BOTH `enumDDL` (DO $$ blocks) AND the standalone enum loop. The duplicate is harmless but adds noise. Tech-debt task #2 tracks cleanup.

## Bootstrap sequence (correct order)
1. `enumDDL` — all type definitions (DO $$ blocks)
2. `tableDDL` — all base tables
3. `alterDDL` — additive column/table migrations
4. enum loop — `ALTER TYPE ADD VALUE` + `CREATE TYPE` as separate `pool.query()` calls
5. `loyaltyDDL` — loyalty tables (depends on enums from step 1/4)
