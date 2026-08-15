import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/sse/user_sse_provider.dart';
import '../../../models/notification_model.dart';
import '../../../services/notification_service.dart';
import '../../auth/providers/auth_providers.dart';

// ── Service provider ──────────────────────────────────────────────────────────

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(ref.watch(dioClientProvider).dio);
});

// ── Notifications list + read state ──────────────────────────────────────────

/// Holds the full (up to 50) notifications list.
/// Optimistic `isRead` updates are applied locally; a background invalidation
/// after each mark-read call keeps the server state in sync.
class NotificationsNotifier extends AsyncNotifier<List<NotificationModel>> {
  @override
  Future<List<NotificationModel>> build() {
    return ref.read(notificationServiceProvider).fetchNotifications();
  }

  /// Pull-to-refresh.
  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(notificationServiceProvider).fetchNotifications(),
    );
  }

  /// Optimistically marks one notification as read, then syncs in the background.
  Future<void> markRead(int id) async {
    // Optimistic update — instant visual feedback.
    state = state.whenData(
      (list) => [
        for (final n in list)
          if (n.id == id) n.copyWith(isRead: true) else n,
      ],
    );
    try {
      await ref.read(notificationServiceProvider).markRead(id);
    } catch (_) {
      // Silently ignore — the list re-syncs on the next SSE event or refresh.
    }
  }

  /// Optimistically marks every notification as read.
  Future<void> markAllRead() async {
    // Optimistic update.
    state = state.whenData(
      (list) => [for (final n in list) n.copyWith(isRead: true)],
    );
    try {
      await ref.read(notificationServiceProvider).markAllRead();
    } catch (_) {}
  }
}

final notificationsProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<NotificationModel>>(
  NotificationsNotifier.new,
);

// ── Derived: unread count ─────────────────────────────────────────────────────

/// Auto-updated count that drives the notification badge on the bottom nav
/// and the home-header bell dot.
final unreadNotificationsCountProvider = Provider<int>((ref) {
  final asyncList = ref.watch(notificationsProvider);
  return asyncList.asData?.value.where((n) => n.isUnread).length ?? 0;
});

// ── Global SSE subscription ───────────────────────────────────────────────────

/// Derived from [userSseProvider] — the single shared SSE connection.
/// Filters for `new_notification` events and invalidates the notifications list.
///
/// Not autoDispose — lives for the entire authenticated session.
/// Watched from [CustomerHomeScreen] to anchor the underlying SSE connection.
final notificationsSseProvider = StreamProvider<void>((ref) async* {
  // Watching userSseProvider here ensures exactly ONE SSE connection is opened
  // for the whole session. Wallet and other features derive from the same stream.
  final events = ref.watch(userSseProvider);

  yield* events.when(
    loading: () => const Stream.empty(),
    error: (_, __) => const Stream.empty(),
    data: (event) async* {
      if (event.event == 'new_notification') {
        ref.invalidate(notificationsProvider);
      }
      yield null;
    },
  );
});
