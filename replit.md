# Fnashha (فنشها)

Arabic-language home services marketplace: customers request home service jobs (plumbing, electrical, etc.), technicians submit offers, and an admin/founder back office manages users, loyalty, and CMS content.

## Run & Operate

- The app runs as three Replit artifacts/workflows, already configured and running:
  - `artifacts/fnashha: web` — customer/technician/admin frontend (Vite, preview path `/`)
  - `artifacts/api-server: API Server` — Express API (preview path `/api`)
  - `artifacts/mockup-sandbox: Component Preview Server` — canvas component preview, dev-only
- `pnpm --filter @workspace/api-server run dev` — run the API server manually (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (provisioned)
- Required env: `PUBLIC_APP_URL` — Public base URL of the app, **no trailing slash** (e.g. `https://fnashha.com`). Used to generate referral links (`{PUBLIC_APP_URL}/r/{CODE}`). Change this value alone when moving to a new domain — no code changes needed.
- Required env: `SESSION_SECRET`, `FOUNDER_PASSWORD` — auth/session and founder-account bootstrap
- Required env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — CMS media uploads
- Required env: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_APP_ID`, `FIREBASE_WEB_MESSAGING_SENDER_ID`, `FIREBASE_VAPID_KEY`/`FIREBASE_WEB_VAPID_KEY` — push notifications
- On first boot with a fresh DB, a Founder account is auto-created (mobile logged to server startup output) using `FOUNDER_PASSWORD`.
- SEO/deep-link repository assets live in `artifacts/fnashha/public/` and are documented in `docs/SEO_DEPLOYMENT.md`. The web build prerenders the public route shells and the production artifact rewrites clean public URLs to those shells. Replace the explicit Android certificate and Apple Team ID placeholders before publishing.
- Dynamic service-area SEO pages are derived server-side from the existing technician service/area relationships and are added to the build-time sitemap only when an approved, active technician can receive that service in the active area. See `artifacts/api-server/src/lib/seo-landing-pages.ts` and `docs/SEO_DEPLOYMENT.md`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Loyalty scheduler

- Coin maturation (`earn_pending` → `earn_available`) and expiry (`earn_available` → expired) run **fully automatically** via `node-cron` in `artifacts/api-server/src/lib/loyaltyScheduler.ts`, started once from `index.ts` right after the server begins listening.
- Cron schedule: maturation every 30 minutes (`*/30 * * * *`), expiry every hour on the hour (`0 * * * *`). Both jobs also run once immediately on startup to catch anything missed during downtime.
- Both cron ticks and the manual admin endpoint (`POST /api/loyalty/admin/run-scheduler`, requires `loyalty.manage`) call the exact same `maturePendingCoins()` / `expireAvailableCoins()` functions in `loyaltyEngine.ts` — no duplicated business logic.
- Each run is idempotent (UPDATE-RETURNING claim + `SELECT ... FOR UPDATE` wallet locks), so overlapping/duplicate runs never double-credit or double-expire coins. Each tick is wrapped in try/catch — a failure is logged and the scheduler keeps running on its next tick, never crashing the API.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
