---
name: Fnashha security hardening batch
description: 17 security/quality fixes applied in one audit pass — what changed, key constraints, and pre-existing baseline noise.
---

## What was fixed

1. **Helmet** — added to `app.ts` with `contentSecurityPolicy: false` (API server never serves HTML; frontend manages its own CSP) and `crossOriginResourcePolicy: cross-origin` (for /uploads static files).
2. **CORS fail-closed** — `app.ts` throws at startup if `NODE_ENV=production` and `CORS_ORIGIN` is unset. Dev allows any localhost origin. Comma-separated `CORS_ORIGIN` supported.
3. **Global rate limiter** — 300 req / 15 min per IP on all `/api` routes; auth routes keep their own tighter limits.
4. **DATABASE_URL startup guard** — `index.ts` checks `DATABASE_URL`/`NEON_DATABASE_URL` before module graph is fully loaded; also validates `FOUNDER_PASSWORD` ≥ 8 chars if set.
5. **Zip Slip** — `admin-database.ts` restore path uses `path.resolve` + `startsWith(uploadsRoot + sep)` guard before `writeFileSync`.
6. **Message ownership** — `messages.ts` GET and PATCH read-all: added `assertMessageAccess()` helper that fetches the request and checks `customerId` or `selectedTechnicianId` match. Admin/super_admin bypass.
7. **Offer ownership** — `offers.ts` GET `/requests/:requestId/offers`: only request owner, assigned technician, or admin may list offers (prevents competitor bid leaking).
8. **DOMPurify** — installed + wrapped all four CMS pages: terms, privacy, faq, refund-policy.
9. **Error Boundary** — `src/components/error-boundary.tsx` (Arabic fallback UI); wraps the entire `App` in `App.tsx`.
10. **Base64 validation** — max 2,800,000 chars (~2 MB), MIME prefix check. Applied at technician registration (auth.ts) and user profile update (users.ts profileImage field).
11. **Pagination caps** — notifications: page/limit params (default 50, max 100); banners: hard cap 200; governorates: hard cap 500; areas: hard cap 2000.
12. **Service worker cleanup** — removed `swPhoneHome()` function, all `console.log` calls, and the raw `push` event listener. Core `onBackgroundMessage` + `notificationclick` preserved.
13. **Search length validation** — `users.ts` admin search: rejects `search` strings > 100 chars with 400.
14. **Source maps disabled in prod** — `build.mjs`: `sourcemap` and `drop` keyed on `NODE_ENV === "development"` (dev workflow sets this).
15. **Console drop** — `build.mjs` drops `["console","debugger"]` for non-dev builds; `vite.config.ts` adds `esbuild: { drop: ["console","debugger"] }`.
16. **DB indexes** — added to schema + bootstrap DDL (`CREATE INDEX IF NOT EXISTS`): `technician_profiles.primary_area_id`, `service_requests.selected_technician_id/governorate_id`, `ratings.technician_id`, `point_transactions.request_id/admin_id`, `price_adjustments.request_id/technician_id`, `ticket_replies.ticket_id/sender_id`, `audit_trail.request_id/changed_by`.
17. **Node version pin** — root `package.json` `engines.node >= 24.0.0`.

## Pre-existing baseline TS noise (NOT caused by these changes)

- `lib/api-client-react` has no build script → `TS6305` on every consumer (pre-existing, suppressed in Vite's transpile-only build).
- `CldImg` `src: string | null` vs `ImgHTMLAttributes.src: string | undefined` type mismatch (pre-existing).

## Key constraints still in force

- Do NOT touch: auth architecture, refresh tokens, localStorage strategy, Bootstrap DDL architecture (adding stmts is fine), national ID, XLSX, cascade deletes, financial/wallet/loyalty/commission logic, per-transaction point caps.
- CORS: always fail-closed in production (`throw` at startup if `CORS_ORIGIN` missing).
- DB SSL: already env-var-driven (`DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`) — do not change.

**Why:** The audit found 17 discrete vulnerabilities (Zip Slip, open CORS, unowned message/offer reads, raw HTML injection, unbounded queries, leaked source maps, etc.) and fixed them all without touching business logic.
