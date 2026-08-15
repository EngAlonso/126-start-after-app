---
name: Fnashha Flutter mobile auth UI
description: Phase 2 auth UI decisions on top of the Phase 1 Flutter foundation — remember-me design, registration flow split, catalog data layer.
---

- `GET /auth/me` returns user fields spread at the top level (`{...formatUser(user), permissions}`), unlike `/auth/login` and `/auth/register/*` which nest under a `user` key. Any new client code reading `/auth/me` must not do `data['user']`.
- Technician registration never logs the caller in — backend leaves the account `status: pending` and issues no tokens (`{pending:true, user}`). Client must not attempt session persistence on this path; show an explicit "awaiting approval" screen instead of navigating into a home shell.
- "Remember Me" can't mean "don't persist tokens" because the auth interceptor needs them in secure storage for every request while the app runs. Implemented instead as: wipe the session on app teardown (`WidgetsBindingObserver.didChangeAppLifecycleState` → `AppLifecycleState.detached`) when the last login had remember-me unchecked.
  **Why:** the only place "don't remember me" can safely take effect without breaking mid-session requests.
  **How to apply:** reuse `AuthRepository.clearSessionIfNotRemembered()` / `SecureStorageService.getRememberMe()` rather than inventing a second persistence path. Note `detached` isn't guaranteed on iOS hard-kill — accepted limitation, not a bug to chase.
- Reference data with no local state (services/governorates/areas catalog for technician registration) skips the repository layer entirely — providers call the service directly. Only add a repository when there's storage/session state to coordinate (see `AuthRepository`).
