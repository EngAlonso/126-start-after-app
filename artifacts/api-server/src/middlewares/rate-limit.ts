import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response } from "express";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable rate-limiting factory for authentication endpoints only.
//
// This is the single place that configures express-rate-limit — every auth
// route that needs protection imports a limiter created here instead of
// calling rateLimit() inline, so the response shape and defaults never drift
// between routes.
//
// Limits are configurable via environment variables so they can be tuned per
// deployment without a code change; sane production defaults are used when
// the env vars are not set.
//
// In development (NODE_ENV !== "production") all auth rate limiters are
// bypassed entirely so local testing and Expo preview sessions are never
// blocked by leftover counters from diagnostic runs. Production security is
// completely unaffected — the skip function is never active there.
// ─────────────────────────────────────────────────────────────────────────────

const isDev = process.env["NODE_ENV"] !== "production";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Standard JSON body for every rate-limited rejection — no stack traces,
// limit internals, or window timing exposed to the client.
function rateLimitHandler(_req: Request, res: Response) {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
}

function makeLimiter(options: Partial<Options> & { windowMs: number; limit: number }) {
  const { windowMs, limit, ...rest } = options;
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true, // adds RateLimit-* headers
    legacyHeaders: false, // omit deprecated X-RateLimit-* headers
    handler: rateLimitHandler,
    // Skip rate-limiting entirely in development so Expo preview sessions and
    // local test runs are never blocked. Has zero effect in production.
    skip: isDev ? () => true : undefined,
    // Rate-limit per client IP. req.ip already resolves correctly once
    // `trust proxy` is configured on the Express app (see app.ts) — that is
    // what makes this safe behind Replit's/Cloudflare's/Nginx's reverse proxy.
    ...rest,
  });
}

// POST /api/auth/login — 5 attempts / 15 minutes per IP (brute-force guard).
export const loginRateLimiter = makeLimiter({
  windowMs: envInt("AUTH_LOGIN_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  limit: envInt("AUTH_LOGIN_RATE_LIMIT_MAX", 5),
});

// POST /api/auth/register/* — 5 requests / hour per IP (signup-spam guard).
export const registerRateLimiter = makeLimiter({
  windowMs: envInt("AUTH_REGISTER_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000),
  limit: envInt("AUTH_REGISTER_RATE_LIMIT_MAX", 5),
});

// Reserved for forgot-password / reset-password / OTP verification routes if
// they are added later — same 5/hour default as registration, kept as a
// separate limiter so it can be tuned independently.
export const passwordResetRateLimiter = makeLimiter({
  windowMs: envInt("AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000),
  limit: envInt("AUTH_PASSWORD_RESET_RATE_LIMIT_MAX", 5),
});

// POST /api/auth/refresh — much higher ceiling than login, since access
// tokens now expire every 15 minutes and legitimate clients call this
// automatically in the background. Still capped to blunt refresh-token
// brute-forcing / hammering.
export const refreshRateLimiter = makeLimiter({
  windowMs: envInt("AUTH_REFRESH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  limit: envInt("AUTH_REFRESH_RATE_LIMIT_MAX", 30),
});
