import 'package:flutter/material.dart';

import '../../../models/notification_model.dart';
import '../../../theme/app_colors.dart';
import 'price_approved_notification_icon.dart';
import 'price_rejected_notification_icon.dart';

/// Premium notification card — branded left border, type icon, relative
/// timestamp, and a subtle unread tint. Tapping marks read and navigates.
class NotificationCard extends StatelessWidget {
  const NotificationCard({
    super.key,
    required this.notification,
    required this.onTap,
  });

  final NotificationModel notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isUnread = notification.isUnread;
    final isPriceRejected = _isPriceRejected(notification);
    final isPriceApproved = _isPriceApproved(notification);
    final meta = _typeMeta(
      notification.type,
      isPriceRejected: isPriceRejected,
      isPriceApproved: isPriceApproved,
    );

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        decoration: BoxDecoration(
          color: isUnread
              ? (isDark
                    ? AppColors.gold.withValues(alpha: 0.07)
                    : AppColors.gold.withValues(alpha: 0.05))
              : (isDark ? AppColors.darkCard : AppColors.lightCard),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUnread
                ? AppColors.gold.withValues(alpha: 0.35)
                : (isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder),
          ),
          boxShadow: isUnread
              ? [
                  BoxShadow(
                    color: AppColors.gold.withValues(alpha: 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 2),
                  ),
                ]
              : [],
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Coloured left accent bar ──────────────────────────────────
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: meta.color,
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(14),
                    bottomRight: Radius.circular(14),
                  ),
                ),
              ),

              // ── Icon ──────────────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 14, 8, 14),
                child: isPriceRejected
                    ? const PriceRejectedNotificationIcon()
                    : isPriceApproved
                        ? const PriceApprovedNotificationIcon()
                        : Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: meta.color.withValues(alpha: 0.12),
                            ),
                            child: Icon(
                              meta.icon,
                              color: meta.color,
                              size: 20,
                            ),
                          ),
              ),

              // ── Text ──────────────────────────────────────────────────────
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: 14,
                    horizontal: 4,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              notification.title,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: isUnread
                                    ? FontWeight.w700
                                    : FontWeight.w600,
                                color: isDark
                                    ? AppColors.darkForeground
                                    : AppColors.lightForeground,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          // Unread dot
                          if (isUnread)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(top: 4, left: 4),
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.gold,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        notification.body,
                        style: TextStyle(
                          fontSize: 12.5,
                          color: isDark
                              ? AppColors.darkMutedForeground
                              : AppColors.lightMutedForeground,
                          height: 1.4,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      // Timestamp + action hint
                      Row(
                        children: [
                          Icon(
                            Icons.access_time_rounded,
                            size: 11,
                            color: isDark
                                ? AppColors.darkMutedForeground
                                : AppColors.lightMutedForeground,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            _relativeTime(notification.createdAt),
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark
                                  ? AppColors.darkMutedForeground
                                  : AppColors.lightMutedForeground,
                            ),
                          ),
                          if (notification.relatedId != null &&
                              _hasDeepLink(notification.type)) ...[
                            const Spacer(),
                            Text(
                              'عرض التفاصيل ›',
                              style: TextStyle(
                                fontSize: 11,
                                color: meta.color,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 12),
            ],
          ),
        ),
      ),
    );
  }

  // ── Type metadata ─────────────────────────────────────────────────────────

  static _TypeMeta _typeMeta(
    String type, {
    bool isPriceRejected = false,
    bool isPriceApproved = false,
  }) {
    if (isPriceRejected) {
      return _TypeMeta(
        icon: Icons.price_change_rounded,
        color: AppColors.destructive,
      );
    }
    if (isPriceApproved) {
      return _TypeMeta(
        icon: Icons.price_change_rounded,
        color: AppColors.chartGreen,
      );
    }

    return switch (type) {
      'new_offer' => _TypeMeta(
        icon: Icons.local_offer_rounded,
        color: AppColors.chartBlue,
      ),
      'technician_selected' => _TypeMeta(
        icon: Icons.handyman_rounded,
        color: AppColors.chartGreen,
      ),
      'new_message' => _TypeMeta(
        icon: Icons.chat_bubble_rounded,
        color: AppColors.chartBlue,
      ),
      'price_adjustment' => _TypeMeta(
        icon: Icons.price_change_rounded,
        color: const Color(0xFFF59E0B),
      ),
      'status_change' => _TypeMeta(
        icon: Icons.swap_horiz_rounded,
        color: AppColors.chartPurple,
      ),
      'support_reply' => _TypeMeta(
        icon: Icons.support_agent_rounded,
        color: const Color(0xFF06B6D4),
      ),
      'announcement' => _TypeMeta(
        icon: Icons.campaign_rounded,
        color: AppColors.gold,
      ),
      'platform_credit_added' => _TypeMeta(
        icon: Icons.account_balance_wallet_rounded,
        color: AppColors.chartGreen,
      ),
      'platform_credit_paid' => _TypeMeta(
        icon: Icons.payment_rounded,
        color: AppColors.destructive,
      ),
      'new_request' => _TypeMeta(
        icon: Icons.add_circle_rounded,
        color: AppColors.chartBlue,
      ),
      _ => _TypeMeta(icon: Icons.notifications_rounded, color: AppColors.gold),
    };
  }

  /// The API can currently persist this event as `status_change`, so use the
  /// notification's semantic text as a narrow fallback without changing the
  /// artwork for other status changes.
  static bool _isPriceRejected(NotificationModel notification) {
    const rejectedTitle = 'تم رفض تعديل السعر';
    return notification.type == 'price_rejected' ||
        notification.title.contains(rejectedTitle) ||
        notification.body.contains(rejectedTitle);
  }

  /// The API may persist this event as `status_change`, so identify approval
  /// by its exact semantic text without changing other status-change artwork.
  static bool _isPriceApproved(NotificationModel notification) {
    const approvedTitle = 'تم قبول تعديل السعر';
    return notification.type == 'price_approved' ||
        notification.title.contains(approvedTitle) ||
        notification.body.contains(approvedTitle);
  }

  static bool _hasDeepLink(String type) {
    return const {
      'new_offer',
      'technician_selected',
      'new_message',
      'price_adjustment',
      'status_change',
      'support_reply',
    }.contains(type);
  }

  // ── Relative timestamp in Arabic ─────────────────────────────────────────

  static String _relativeTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 60) return 'الآن';
    if (diff.inMinutes < 60) {
      final m = diff.inMinutes;
      if (m == 1) return 'منذ دقيقة';
      if (m == 2) return 'منذ دقيقتين';
      if (m <= 10) return 'منذ $m دقائق';
      return 'منذ $m دقيقة';
    }
    if (diff.inHours < 24) {
      final h = diff.inHours;
      if (h == 1) return 'منذ ساعة';
      if (h == 2) return 'منذ ساعتين';
      if (h <= 10) return 'منذ $h ساعات';
      return 'منذ $h ساعة';
    }
    if (diff.inDays == 1) return 'أمس';
    if (diff.inDays < 7) return 'منذ ${diff.inDays} أيام';
    // Fallback: dd/MM
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

class _TypeMeta {
  const _TypeMeta({required this.icon, required this.color});
  final IconData icon;
  final Color color;
}
