---
name: Fnashha env after fresh import
description: What to check/fix right after importing the fnashha project zip into a fresh Replit workspace.
---

After importing from a zip, `replit.md` may still be the unfilled template even though the codebase (artifacts/fnashha, artifacts/api-server, lib/*) is the fully-built fnashha app — don't assume "template placeholder" means "empty project", check `artifacts/` and `pnpm-workspace.yaml` first.

Symptoms seen on fresh import:
- `node_modules` missing → `vite: command not found` / `Cannot find package 'esbuild'`. Fix: `pnpm install` at the workspace root.
- A legacy monorepo-wide "Start application" workflow (binding ports 3000+8080 directly) can coexist with the artifact system's own auto-registered workflows (`artifacts/fnashha: web`, `artifacts/api-server: API Server`), causing `EADDRINUSE` on both ports.

**Why:** the artifact registration system auto-creates per-service workflows once artifacts are added to project metadata; the old combined workflow from the import is redundant and conflicts.

**How to apply:** remove the legacy combined workflow (`removeWorkflow({ name: "Start application" })`) and restart the artifact-owned workflows instead. If a port is still stuck after removing, `lsof -i :<port> -t | xargs kill -9` before restarting.
