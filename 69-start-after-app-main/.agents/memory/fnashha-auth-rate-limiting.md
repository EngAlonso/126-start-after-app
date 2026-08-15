---
name: Fnashha auth rate limiting
description: How brute-force protection is configured on login/registration endpoints.
---

## Rule
`middlewares/rate-limit.ts` is the single factory for auth rate limiters (`loginRateLimiter`, `registerRateLimiter`, `passwordResetRateLimiter` reserved for future forgot/reset/OTP routes). All limits are env-configurable (`AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`, `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`, similarly for password reset) with production defaults: login 5/15min, register 5/hour, both per-IP.

**Why:** brute-force protection must apply uniformly regardless of account role (including Founder/super_admin) — the limiter runs before any DB lookup or role check, so there is no bypass path. `app.set("trust proxy", 1)` in `app.ts` was required for `req.ip` (and thus per-IP limiting) to reflect the real client instead of Replit's reverse-proxy IP.

## How to apply
- Any new auth endpoint (forgot-password, reset-password, OTP) should import an existing limiter from `rate-limit.ts` (or add a new one there) rather than configuring `express-rate-limit` inline.
- Customer and technician registration share the same `registerRateLimiter` bucket (same IP), so hitting one exhausts the other's quota too — intentional, since both are signup endpoints from the same abuse surface.
- 429 responses always return `{"success": false, "message": "Too many requests. Please try again later."}` — no internals exposed.
