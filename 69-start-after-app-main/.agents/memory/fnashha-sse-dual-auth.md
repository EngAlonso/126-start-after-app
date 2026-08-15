---
name: Fnashha SSE dual authentication
description: How SSE endpoints authenticate mobile (EventSource, no custom headers) vs PWA/API clients without duplicating JWT logic.
---

## Rule
`extractToken(req, allowQueryParam)` and `verifyToken(token)` in `middlewares/auth.ts` are the single source of truth for pulling/validating a JWT. `authenticate` (regular API routes) calls `extractToken(req)` — header only. `routes/events.ts` (both `/admin/events` and `/events`) calls `extractToken(req, true)` — header OR `?token=` query param, header wins if both present.

**Why:** iOS/Android native EventSource implementations cannot set custom headers, so SSE must accept a query-string token. Query-param tokens are more exposed (server logs, proxies) than headers, so the fallback is opt-in per-route (`allowQueryParam` flag) rather than global on `authenticate`, keeping normal REST endpoints header-only.

## How to apply
- Any new SSE/streaming endpoint should call `extractToken(req, true)` + `verifyToken()`, not re-implement `jwt.verify` inline.
- Any new endpoint that must stay strictly header-based (regular REST) should keep using `authenticate` middleware as-is — do not flip its default to allow query tokens.
- Frontend SSE hooks (`use-user-events.ts`, `use-admin-events.ts`) already build `?token=` URLs for native `EventSource` — this is intentional and required for mobile; no change needed there for Flutter compatibility, since Flutter can hit the same `?token=` URL pattern.
