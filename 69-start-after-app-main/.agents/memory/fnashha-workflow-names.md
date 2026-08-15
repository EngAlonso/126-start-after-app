---
name: Fnashha workflow names
description: The actual registered workflow names for Fnashha's services, which differ from artifact.toml service names.
---

The artifact.toml `[[services]]` blocks name services "API Server" and "web", but the platform registers running workflows with the pattern `<artifact-dir>: <service-name>`:

- `artifacts/api-server: API Server` — backend (port 8080)
- `artifacts/fnashha: web` — frontend (port 24420)
- `artifacts/mockup-sandbox: Component Preview Server` — canvas sandbox (port 8081)

**Why:** calling `restart_workflow` or `configureWorkflow` with the bare service name (e.g. "API Server") fails with `RUN_COMMAND_NOT_FOUND` or creates a duplicate workflow that then fails on port conflict, because the real registered name includes the artifact directory prefix.

**How to apply:** Always run `listWorkflows()` first to get the exact current names before restarting, rather than guessing from artifact.toml.
