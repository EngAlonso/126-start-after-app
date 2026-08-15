---
name: Fnashha refresh-token auth system
description: Design of the access+refresh token pair, rotation, and theft detection added to replace the old 30-day access token.
---

Access tokens are now short-lived (`ACCESS_TOKEN_EXPIRES_IN`, default 15m) instead of the old flat 30-day JWT. A companion refresh token (`REFRESH_TOKEN_EXPIRES_IN`, default 30d) lets clients silently mint new access tokens without re-login.

**Design:** the refresh token is itself a JWT (`{sub: userId, jti}`) signed with a distinct secret (`JWT_REFRESH_SECRET`, or an HMAC of `SESSION_SECRET` if that env var is unset — zero-config by default). Only its SHA-256 hash is ever persisted, in a `refresh_tokens` table (userId, tokenHash, deviceId, createdAt, expiresAt, revokedAt, lastUsedAt). One row per device/session.

**Rotation + theft detection** lives entirely in `artifacts/api-server/src/lib/refreshTokens.ts` (`rotateRefreshToken`): every `/auth/refresh` call marks the used row revoked and inserts a new row. If a token whose row is *already* revoked is presented again (reuse), every active token for that user is revoked immediately, forcing full re-login — this is what catches token theft/replay.

**Why:** rotation-with-reuse-detection is the standard mitigation for stolen refresh tokens (OWASP), and hashing-only storage means a DB leak can't be replayed as valid sessions.

**How to apply:** routes never touch the `refresh_tokens` table directly — always go through `refreshTokens.ts` (`issueTokenPair`, `rotateRefreshToken`, `revokeRefreshToken`, `revokeAllUserTokens`) so the invariants can't be bypassed. Login/register responses now include `token` (back-compat alias for `accessToken`), `accessToken`, and `refreshToken`.

**Frontend wiring:** `lib/api-client-react/src/custom-fetch.ts` exposes `setUnauthorizedHandler()` — a global 401-interceptor hook that retries the failed request once after a caller-supplied refresh callback succeeds. `auth-context.tsx` registers this handler, dedupes concurrent refreshes via an in-flight promise ref, and does a best-effort `POST /auth/logout` with the stored refresh token on sign-out (single-device revoke) or `/auth/logout-all` for all-device sign-out. No changes were needed at individual `useLogout()`/API call sites.

Founder/super_admin/admin/technician/customer all go through the exact same login/refresh code path — no role-based branching exists in the refresh-token logic, consistent with the earlier rate-limiting decision to never special-case any role on auth endpoints.
