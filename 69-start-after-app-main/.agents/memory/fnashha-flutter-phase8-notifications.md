---
name: Fnashha Flutter Phase 8 — Notifications module
description: Notifications architecture, SSE keepalive pattern, and test override strategy for providers that open HTTP connections.
---

# Flutter Phase 8 — Notifications module

## Provider architecture

### Non-autoDispose SSE provider for session-long connections
`notificationsSseProvider = StreamProvider<void>` (no autoDispose) is the pattern for global session-long SSE connections. It must be **watched** from a screen that is always mounted (CustomerHomeScreen) to stay alive. Without a watcher, Riverpod disposes non-autoDispose providers too.

**Why:** autoDispose would close the connection when no screen is watching (e.g. user on a sub-screen). Non-autoDispose + explicit watch from the root screen keeps it alive exactly for the session duration.

### Derived count provider
`unreadNotificationsCountProvider = Provider<int>` derived from `notificationsProvider.asData?.value` (not `valueOrNull` — that doesn't exist in Riverpod 3). This auto-updates whenever the list changes (SSE or refresh).

## Test pattern: override HTTP-making providers

When a `ConsumerStatefulWidget` watches a provider that opens HTTP connections or creates timers (SSE, Dio calls), widget tests fail with "A Timer is still pending even after the widget tree was disposed." Fix: override those providers in the `ProviderScope`:

```dart
ProviderScope(
  overrides: [
    notificationsSseProvider.overrideWith((ref) async* {}),
    notificationsProvider.overrideWith(_StubNotificationsNotifier.new),
  ],
  child: MaterialApp(...),
)
```

Where `_StubNotificationsNotifier extends NotificationsNotifier` and overrides `build()` to return `[]` immediately.

**This pattern applies to any screen test where the screen watches SSE or API providers.**

## Deep-link routing by notification type
- `new_message` + relatedId → `/requests/{id}/chat`
- `new_offer` + relatedId → `/requests/{id}/offers`
- `technician_selected`, `price_adjustment`, `status_change`, `support_reply` + relatedId → `/requests/{id}`
- `platform_credit_added`, `platform_credit_paid` → wallet (future, no-op for now)
- `announcement`, `new_request` → no navigation (info-only)

## Notification type → icon/color mapping
- `new_offer` → chartBlue, Icons.local_offer_rounded
- `technician_selected` → chartGreen, Icons.handyman_rounded
- `new_message` → chartBlue, Icons.chat_bubble_rounded
- `price_adjustment` → amber (#F59E0B), Icons.price_change_rounded
- `status_change` → chartPurple, Icons.swap_horiz_rounded
- `support_reply` → cyan (#06B6D4), Icons.support_agent_rounded
- `announcement` → gold, Icons.campaign_rounded
- `platform_credit_added` → chartGreen, Icons.account_balance_wallet_rounded
- `platform_credit_paid` → destructive, Icons.payment_rounded

## HomeBottomNavBar badge
`badgeCounts: Map<HomeNavDestination, int>` parameter added. Any destination with count > 0 shows a red badge (capped at 99+) on the icon using a `Stack` + `Positioned`.

## Riverpod 3 API reminder
- Use `asData?.value` NOT `valueOrNull` — `valueOrNull` does not exist in Riverpod 3.
