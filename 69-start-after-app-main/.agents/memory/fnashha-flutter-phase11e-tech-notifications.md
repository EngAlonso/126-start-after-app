---
name: Fnashha Flutter Phase 11E — Technician Notifications
description: How technician notifications reuse the customer notifications module and what actually needed changing.
---

The backend `/notifications`, `/notifications/:id/read`, and `/notifications/read-all`
routes are already role-agnostic — they key everything off `req.user.id`, so a technician's
JWT naturally returns only their own rows. No backend changes were needed.

On the Flutter side, `NotificationsScreen`, `notificationsProvider` (list + optimistic
read/mark-all-read), `unreadNotificationsCountProvider` (badge), and `notificationsSseProvider`
(derived from the single shared `userSseProvider` SSE stream) were already fully shared —
`TechnicianHomeScreen` was already pushing the same `/notifications` route and watching the
same providers before Phase 11E started. There was no separate technician screen to build.

The only role-specific gap was deep-link destinations: several notification `type` values are
sent to only one role (`new_request` → technicians only, an available job to bid on; `new_offer`
→ customers only) while others are shared but need a different destination per role
(`technician_selected`/`status_change` → `technicianJobDetail` for a technician vs
`requestDetail` for a customer). Extracted this into a single
`navigateForNotification(context, notif, {required isTechnician})` resolver
(`lib/features/notifications/notification_navigation.dart`) instead of forking the screen.

**Why it matters:** when a "build the technician version of X" task turns up an already-fully-
wired shared screen/provider, look specifically for role-conditional business logic (deep links,
permission checks) hiding inside otherwise-shared code before assuming a new screen is needed.

**Gotcha:** a `UserModel` extension (`isCustomer`/`isTechnician`/`isAdmin` on `UserModelRole`)
must be imported at the call site (`models/user_model.dart`) to be visible — importing only
`auth_providers.dart` (which re-exports the `Authenticated(user)` type) is not enough; Dart
extensions require their own explicit import.
