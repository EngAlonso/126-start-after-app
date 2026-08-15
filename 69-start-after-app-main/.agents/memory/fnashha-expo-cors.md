---
name: Fnashha Expo CORS fix
description: Why Expo web preview gets "Failed to fetch" and how the CORS fix works.
---

## Rule
The API server's dev-mode CORS must allow `*.replit.dev` subdomains, not just `localhost`/`127.0.0.1`.

## Why
Replit's artifact router gives the Expo web preview a **different subdomain** from the main dev domain:
- Main dev domain: `*.spock.replit.dev`  (API server at path `/api`)
- Expo dev domain: `*.expo.spock.replit.dev`  (Expo Metro server)

Cross-origin POST requests trigger a CORS preflight. Without `*.replit.dev` in the allowed origins, the server returned HTTP 200 for OPTIONS but with no `Access-Control-Allow-Origin` header → browser blocked every fetch → "Failed to fetch".

The React web app is unaffected because Vite proxies `/api` to localhost — no cross-origin request ever leaves the browser.

## How to apply
`artifacts/api-server/src/app.ts` CORS section — the `devReplitPattern` regex is:
```
/^https:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.replit\.dev$/
```
This allows any `*.replit.dev` subdomain in dev mode (where `NODE_ENV !== "production"`).
In production, `CORS_ORIGIN` must be set explicitly (startup guard enforces this).

## Verification
- OPTIONS preflight from Expo origin → HTTP 204 + `Access-Control-Allow-Origin` ✅
- POST `/api/auth/login` from Expo origin → HTTP 200 + CORS headers + tokens ✅
- OPTIONS from arbitrary `evil.attacker.com` → no CORS headers (browser blocks) ✅
