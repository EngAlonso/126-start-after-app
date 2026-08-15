import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// The custom app bar for the home screen: logo, greeting, location pill,
/// notification bell, and profile avatar.
///
/// Built as a plain header widget (not a `Scaffold.appBar`) so it can sit
/// on top of the gold gradient backdrop and scroll away naturally with the
/// rest of the page, matching the "hero header bleeds into content" pattern
/// used by Careem/Talabat rather than a flat Material app bar.
class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.userName,
    this.city = 'القاهرة',
    this.hasUnreadNotifications = true,
    this.onNotificationsTap,
    this.onChatTap,
    this.onProfileTap,
  });

  final String userName;

  /// Demo city shown under the user's name — replaced by real location in
  /// a later phase.
  final String city;
  final bool hasUnreadNotifications;
  final VoidCallback? onNotificationsTap;

  /// Phase 7: tapping the chat icon opens the Conversations screen.
  final VoidCallback? onChatTap;
  final VoidCallback? onProfileTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        // ── Logo badge ────────────────────────────────────────────────
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFFFFD700), Color(0xFFE8B800)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.gold.withValues(alpha: 0.38),
                blurRadius: 18,
                spreadRadius: 1,
              ),
            ],
          ),
          child: const Icon(
            Icons.handyman_rounded,
            color: Colors.white,
            size: 22,
          ),
        ),

        const SizedBox(width: 12),

        // ── Greeting + name + location ────────────────────────────────
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _greeting(),
                style: TextStyle(
                  fontSize: 12.5,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                userName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              // Location pill — UI only, demo data
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.location_on_rounded,
                    size: 11,
                    color: AppColors.gold,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    city,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.expand_more_rounded,
                    size: 13,
                    color: AppColors.gold,
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(width: 8),

        // ── Chat icon (Phase 7) ───────────────────────────────────────
        _HeaderIconButton(
          icon: Icons.chat_bubble_outline_rounded,
          showDot: false,
          onTap: onChatTap,
        ),
        const SizedBox(width: 8),

        // ── Notification bell ─────────────────────────────────────────
        _HeaderIconButton(
          icon: Icons.notifications_none_rounded,
          showDot: hasUnreadNotifications,
          onTap: onNotificationsTap,
        ),
        const SizedBox(width: 10),

        // ── Profile avatar ────────────────────────────────────────────
        GestureDetector(
          onTap: onProfileTap,
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? AppColors.darkAccent : AppColors.lightAccent,
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.5),
                width: 1.5,
              ),
            ),
            child: const Icon(
              Icons.person_rounded,
              size: 22,
              color: AppColors.gold,
            ),
          ),
        ),
      ],
    );
  }

  static String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'صباح الخير 👋';
    if (hour < 17) return 'مساء الخير 👋';
    return 'مساء النور 👋';
  }
}

// ─── Icon button with optional notification dot ───────────────────────────

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.showDot,
    this.onTap,
  });

  final IconData icon;
  final bool showDot;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? AppColors.darkAccent : AppColors.lightAccent,
            ),
            child: Icon(icon, size: 22),
          ),
          if (showDot)
            Positioned(
              top: 2,
              right: 2,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.destructive,
                  border: Border.all(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    width: 2,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
