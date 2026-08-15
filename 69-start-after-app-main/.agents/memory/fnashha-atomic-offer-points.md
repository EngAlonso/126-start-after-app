---
name: Fnashha atomic offer selection and points deduction
description: How offer selection and technician points deduction were made concurrency-safe, and a baseline-noise caveat for this codebase's tests/typecheck.
---

## The fixes

- **Offer selection** (`POST /api/requests/:requestId/offers/:offerId/select` in `offers.ts`): the read-check-write sequence (load request, load offer, reject other pending offers, select the winner, update the request) now runs inside a single `db.transaction()`, with `SELECT ... FOR UPDATE` (`.for("update")`) locking both the service-request row and the offer row before any check. Guards added: request must still be `pending`/`offers_received`, offer must still be `pending` — otherwise throw a local `HttpError` (thrown inside the transaction to trigger rollback, caught outside to map to an HTTP status). Concurrent selects on the same request now yield exactly one 200 and one 409, never two winners.
- **Technician points deduction** (inside `POST /api/requests/:id/complete` in `requests.ts`): the profile read + balance/reserved recompute + update + transaction-log insert now runs inside `db.transaction()` with `SELECT ... FOR UPDATE` on the technician profile row, preventing a lost update when two completions deduct from the same technician profile concurrently.

**Why:** both endpoints previously did plain `db.select()` then `db.update()` as separate statements with no lock, so two concurrent requests could both read the same stale row and each write a result that silently discarded the other's update (classic lost-update / double-selection race).

**How to apply:** this codebase's established convention for this is `db.transaction(async (tx) => { ... tx.select()...for("update") ... })` — see `loyaltyEngine.ts` and `points.ts` for more examples. Reuse this pattern for any other read-then-write-based-on-current-value flow in this codebase (e.g. any future wallet/points/status mutation).

## Verification

A concurrency test suite was written at `scripts/test-concurrency.mjs` (Promise.all-based races against the live API + raw pg queries against the DB) — run with `node scripts/test-concurrency.mjs` after the api-server workflow is restarted with current code. All 3 scenarios (concurrent offer selection, re-selection after decision, concurrent points deduction on a shared technician profile) passed 14/14 assertions.

## Baseline noise caveat

This codebase has **pre-existing** typecheck errors (`pnpm --filter @workspace/api-server run typecheck`, ~56 errors) and pre-existing test failures in `scripts/test-phase6.mjs` (6/35 assertions fail — coins-earned amount off by 10x, looks like stale CMS `coinConversionRatio` state from a prior session) that are unrelated to any given change. Before attributing a typecheck/test failure to your own edit, confirm with `git stash` (revert your working-tree changes, rerun, compare counts, `git stash pop`) — don't assume a failing check is caused by the current diff.
