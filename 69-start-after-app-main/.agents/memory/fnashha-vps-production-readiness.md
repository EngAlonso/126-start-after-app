---
name: Fnashha VPS production readiness audit
description: Issues found and fixed during the pre-VPS production readiness audit (July 2026). Key rules for keeping the project VPS-deployable.
---

## Rules to maintain

### File-path env vars must always have defaults
`BACKUPS_DIR` and `UPLOADS_DIR` must never be hardcoded to Replit-specific paths.
Both now default to `process.env.BACKUPS_DIR || path.resolve(process.cwd(), "backups")`.
Always use the same pattern for any new path that needs to survive across environments.

**Why:** The original `BACKUPS_DIR` was hardcoded to `/home/runner/workspace/backups`, which only exists on Replit.

### Bootstrap DDL must cover ALL tables referenced in routes
`maintenance_state` and `maintenance_log` tables were in the schema but missing from `bootstrap.ts`'s `alterDDL`. On a fresh VPS database these routes crashed immediately on startup.

**How to apply:** Whenever you add a new table to `lib/db/src/schema/index.ts`, also add a corresponding `CREATE TABLE IF NOT EXISTS` block to `alterDDL` in `artifacts/api-server/src/lib/bootstrap.ts`.

### ALL_TABLES and RESTORE_ORDER must stay in sync with the schema
`campaign_distributions` and `campaign_execution_logs` were missing from both arrays in `admin-database.ts`. Backup/restore silently skipped those tables.

**How to apply:** Whenever a new table is added to the schema, add it to both `ALL_TABLES` and `RESTORE_ORDER` (in FK dependency order — children after parents) in `artifacts/api-server/src/routes/admin-database.ts`.

### Never log PII (phone numbers, emails) in bootstrap or auth code
`bootstrapFounder()` logged `FOUNDER_PHONE` in plain text. Fixed to log `{ hasFounderPhone: boolean }` instead.

**How to apply:** Use `{ hasFoo: !!process.env.FOO }` pattern in all log calls that reference secrets or PII.

### PostgreSQL SSL: use DB_SSL=true for managed VPS databases
`lib/db/src/index.ts` now supports: auto-detect from `?sslmode=require` in URL, or `DB_SSL=true` env var.
`DB_SSL_REJECT_UNAUTHORIZED=true` enables strict CA verification (off by default for self-signed cert compatibility).

### CORS: use CORS_ORIGIN for production
`app.ts` now reads `CORS_ORIGIN` (comma-separated list). When unset, all origins allowed (safe with Bearer-token auth — no cookies). Set `CORS_ORIGIN=https://fnashha.com` in production.

### Vite config PORT/BASE_PATH must not throw during `vite build`
`PORT` is only needed for the dev server, not for `vite build`. The original guards threw `Error` during CI builds on VPS. Fixed: `PORT` defaults to `3000`, `BASE_PATH` defaults to `/`.

### maintenance.ts package.json path: use __dirname, not process.cwd()
Use `(globalThis as any).__dirname` (set by the esbuild banner in `build.mjs`) to locate the api-server directory in production. Falls back to `process.cwd()` for dev (pnpm changes CWD to the package dir). Never rely on `process.cwd()` alone — it points to the repo root when the process is launched as `node artifacts/api-server/dist/index.mjs`.

### Graceful SIGTERM shutdown
`artifacts/api-server/src/index.ts` now handles SIGTERM/SIGINT with `server.close()` + 30 s force-exit timeout. Process managers (systemd, PM2, Docker) send SIGTERM on restart — without this, SSE clients get broken-pipe errors.

## VPS startup requirement
The API server's CWD must be `artifacts/api-server/` (not the repo root) for the `process.cwd()` fallback in maintenance.ts to find the right package.json files. When using pnpm this is automatic. For direct node invocation: `cd artifacts/api-server && node dist/index.mjs`.

## New files added
- `.env.example` — comprehensive with all env vars documented
- `nginx.example.conf` — reverse proxy config with SSE-specific settings (proxy_buffering off, 1-hour proxy_read_timeout)
