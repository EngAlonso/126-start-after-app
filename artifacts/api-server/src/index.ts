// Load variables from a local .env file (repo root) before anything else
// executes, so `process.env.DATABASE_URL` etc. are populated the same way
// on local Windows/macOS/Linux dev as they are on Replit. Import order here
// matters: this must be the first import so it finishes running before the
// "./app" module graph (which reads process.env at import time, e.g.
// lib/db) is evaluated. dotenv never overwrites a variable that already
// exists in process.env, so Replit Secrets / real environment variables
// always take priority over .env — this is a local-dev fallback only.
import "./lib/loadEnv";

import app from "./app";
import { logger } from "./lib/logger";
import { bootstrap } from "./lib/bootstrap";
import { startLoyaltyScheduler } from "./lib/loyaltyScheduler";

// ─── PROCESS-LEVEL CRASH PROTECTION ──────────────────────────────────────────
// Express only catches synchronous errors and errors passed to next(); a
// rejected promise that nobody awaits/catches (unhandledRejection) or a
// truly uncaught synchronous throw outside any request handler
// (uncaughtException) would otherwise crash the whole process and take down
// every in-flight request for every user. Both are logged via the existing
// structured logger so they are never silent.
//
// unhandledRejection: log and keep running — the process is not necessarily
// in a corrupted state, and killing it would be a bigger outage than the
// original error.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

// uncaughtException: log, then exit. Node's own guidance is that after a
// truly uncaught synchronous exception the process may be in an undefined
// state, so continuing to serve requests is unsafe. The process manager
// (workflow / deployment) restarts the process automatically.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});
// ─────────────────────────────────────────────────────────────────────────────

// DATABASE_URL (or NEON_DATABASE_URL) is required — lib/db will also throw
// at module-init time if missing, but this explicit check fires earlier with
// a clearer startup message before the module graph is fully evaluated.
if (!process.env["DATABASE_URL"] && !process.env["NEON_DATABASE_URL"]) {
  throw new Error(
    "DATABASE_URL (or NEON_DATABASE_URL) environment variable is required but was not provided. " +
    "Provision a PostgreSQL database and set the connection string."
  );
}

// SESSION_SECRET is required for JWT signing — fail fast so misconfiguration
// is never silently masked by a hardcoded fallback.
if (!process.env["SESSION_SECRET"]) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

// FOUNDER_PASSWORD format validation — only when the variable is explicitly
// set. We do not fail startup if it is absent (the founder may already exist
// in the database from a previous bootstrap run).
const _founderPassword = process.env["FOUNDER_PASSWORD"];
if (_founderPassword !== undefined && _founderPassword.trim().length < 8) {
  throw new Error(
    "FOUNDER_PASSWORD must be at least 8 characters. " +
    "Update this environment variable before starting the server."
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
// On SIGTERM (process manager / Docker / systemd stop) or SIGINT (Ctrl-C):
//   1. Stop accepting new connections.
//   2. Wait for in-flight requests to complete (up to 30 s).
//   3. Exit cleanly so the process manager can restart without dangling sockets.
//
// SSE clients (EventSource) will receive a connection-close and reconnect
// automatically — their reconnection is handled client-side.
let _server: ReturnType<typeof app.listen> | null = null;

function gracefulShutdown(signal: string): void {
  logger.info({ signal }, "Received shutdown signal — closing HTTP server");
  if (!_server) {
    process.exit(0);
    return;
  }
  _server.close(() => {
    logger.info("HTTP server closed — process exiting");
    process.exit(0);
  });
  // Force-exit after 30 s if existing connections are still open
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out after 30 s — forcing exit");
    process.exit(1);
  }, 30_000).unref(); // .unref() so this timer never keeps the event loop alive
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
// ─────────────────────────────────────────────────────────────────────────────

// Run DB schema check + super admin seed before accepting traffic
bootstrap()
  .then(() => {
    _server = app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
    // Start loyalty coin scheduler after server is up — fully automatic,
    // no manual admin action required for coin maturation/expiry.
    startLoyaltyScheduler();
  })
  .catch((err) => {
    // Bootstrap failed catastrophically — still start the server
    // so the auth fallback can handle super admin logins
    logger.error({ err }, "Bootstrap failed — starting server in degraded mode");
    _server = app.listen(port, () => {
      logger.info({ port }, "Server listening (degraded mode)");
    });
    // Start scheduler even in degraded mode — DB may recover
    startLoyaltyScheduler();
  });
