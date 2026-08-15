---
name: Fnashha infrastructure port fix
description: Root cause and fix for "Your app is not running" on every restart
---

## The Problem
Frontend was on port 24420 — not in Replit's supported monitoring port list (3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8099, 9000). Replit's health monitor could not check port 24420, so it declared the service "not running" immediately on every startup.

Additionally neither artifact had `[services.env]` with explicit `PORT` for development.

## The Fix (July 2026)
Updated both `artifact.toml` files via `verifyAndReplaceArtifactToml`:

### fnashha (frontend)
- `localPort`: 24420 → 3000
- `[services.env]`: PORT "24420" → "3000", added API_PORT = "8080"

### api-server
- Added `[services.env]` block: PORT = "8080", NODE_ENV = "development" (was missing entirely for dev)

### vite.config.ts
- Added Vite proxy: `/api` and `/uploads` → `http://localhost:8080` (via API_PORT env)

## Why It Works Now
Port 3000 is in Replit's supported list. The health monitor can track it and wait for the service to be ready before declaring it "running". Verified with 4 stop/start cycles — no failures.

**Why:** Replit's preview system monitors only supported ports. Unsupported port = instant "not running".
**How to apply:** Any future service must use a supported port in its artifact.toml `localPort`.
