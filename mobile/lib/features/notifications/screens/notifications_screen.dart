import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/notification_model.dart';
import '../../../models/user_model.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/empty_state_widget.dart';
import '../../../widgets/common/skeleton_widget.dart';
import '../../auth/providers/auth_providers.dart';
import '../notification_navigation.dart';
import '../providers/notifications_provider.dart';
import '../widgets/notification_card.dart';

/// Phase 8 — Full notifications screen.
///
/// Features:
/// • Pull-to-refresh
/// • Loading / empty / error states
/// • Optimistic mark-as-read on tap
/// • "قراءة الكل" action
/// • Deep-link navigation by notification type
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncNotifs = ref.watch(notificationsProvider);
    final unreadCount = ref.watch(unreadNotificationsCountProvider);
    final authData = ref.watch(authControllerProvider).value;
    final isTechnician =
        authData is Authenticated && authData.user.isTechnician;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'الإشعارات',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            if (unreadCount > 0)
              Text(
                '$unreadCount غير مقروء',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.gold,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
        actions: [
          if (unreadCount > 0)
            TextButton.icon(
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllRead(),
              icon: const Icon(Icons.done_all_rounded, size: 18),
              label: const Text('قراءة الكل'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.gold,
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: asyncNotifs.when(
        loading: () => const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: SkeletonList(count: 7),
        ),
        error: (e, _) => _ErrorState(
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
        data: (notifications) => notifications.isEmpty
            ? const EmptyStateWidget(
                icon:     Icons.notifications_none_rounded,
                title:    'لا توجد إشعارات',
                subtitle: 'ستظهر هنا جميع الإشعارات المتعلقة بطلباتك وعروضك والرسائل',
              )
            : _NotificationsList(
                notifications: notifications,
                onTap: (notif) =>
                    _handleTap(context, ref, notif, isTechnician),
              ),
      ),
    );
  }

  void _handleTap(
    BuildContext context,
    WidgetRef ref,
    NotificationModel notif,
    bool isTechnician,
  ) {
    // Mark as read (optimistic).
    if (notif.isUnread) {
      ref.read(notificationsProvider.notifier).markRead(notif.id);
    }
    // Deep-link navigation by notification type — shared resolver, only the
    // destination route differs per role for a few overlapping types.
    navigateForNotification(context, notif, isTechnician: isTechnician);
  }
}

// ── Pull-to-refresh list ──────────────────────────────────────────────────────

class _NotificationsList extends ConsumerWidget {
  const _NotificationsList({
    required this.notifications,
    required this.onTap,
  });

  final List<NotificationModel> notifications;
  final void Function(NotificationModel) onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: () =>
          ref.read(notificationsProvider.notifier).refresh(),
      child: ListView.builder(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        itemCount: notifications.length,
        itemBuilder: (context, index) {
          final notif = notifications[index];
          return NotificationCard(
            notification: notif,
            onTap: () => onTap(notif),
          );
        },
      ),
    );
  }
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
            const SizedBox(height: 12),
            const Text(
              'تعذر تحميل الإشعارات',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: 180,
              child: AppButton(label: 'إعادة المحاولة', onPressed: onRetry),
            ),
          ],
        ),
      ),
    );
  }
}
