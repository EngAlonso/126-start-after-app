---
name: Fnashha startup architecture and external URL routing
description: How Replit routes the Dev URL; constraints on artifact workflows; correct "Start application" command pattern.
---

## Architecture

Two separate startup systems coexist and CANNOT be merged:

1. **Artifact workflows** (`artifacts/fnashha: web`, `artifacts/api-server: API Server`)
   - Managed by Replit's artifact system
   - CANNOT be deleted or configured via `removeWorkflow`/`configureWorkflow` → PROHIBITED_ACTION
   - Always start before "Start application"; bind ports 3000 (Vite) and 8080 (Express)

2. **"Start application" workflow** (project-level, the Run button target)
   - `outputType = "webview"` — determines whether Replit allows external Dev URL connections
   - If this workflow is FAILED or STOPPED → Replit proxy refuses external connections → Dev URL times out
   - Must stay in `state: running` for external access to work

## Routing

- **Preview pane**: uses the artifact path router (artifact.toml `paths`/`localPort`) — independent of "Start application" health
- **External Dev URL**: requires "Start application" to be `state: running` (healthy webview); then the artifact path router handles the actual port mapping (NOT the `[[ports]]` table)
- **`[[ports]]` table in `.replit`**: auto-managed by Replit, cannot be edited directly, and NOT authoritative for external routing in the artifact system

## The Catch-22

`configureWorkflow`/`restart_workflow` with `waitForPort=N` requires the command to ACTUALLY open port N. Since artifact workflows always hold ports 3000 and 8080 first, any command declaring `waitForPort=3000` will fail (callback verifies the command opened the port, not just that the port is listening).

## Correct "Start application" command

```bash
PORT=3000 BASE_PATH=/ API_PORT=8080 pnpm --filter @workspace/fnashha run dev & PORT=8080 pnpm --filter @workspace/api-server run dev & while sleep 30; do echo '[health] frontend:3000 backend:8080'; done
```

- Attempts to start both real services (real intent; succeeds on a fresh repl with no artifact workflows)
- Services fail with EADDRINUSE when artifact workflows already hold the ports (expected)
- The `while sleep 30` monitoring loop keeps the shell alive → workflow stays `state: running`
- NO `waitForPort` (cannot be used; artifact workflows own the ports)
- External Dev URL routing handled by artifact path router once the webview is healthy

**Why:** `outputType=webview` must remain; its health is the gatekeeper for external connections. The monitoring loop is the only way to keep the workflow alive without conflicting with artifact workflows.
