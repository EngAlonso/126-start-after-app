import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../notifications/providers/notifications_provider.dart';
import '../providers/tech_providers.dart';

/// Persistent global app bar shown on every technician tab page.
///
/// Layout (RTL-aware — Flutter AppBar flips leading/actions in RTL):
///   • leading  → physical RIGHT → Fnashha logo button → calls [onLogoTap]
///   • title    → CENTER → points-balance chip → opens Wallet
///   • actions  → physical LEFT  → Messages icon, Notifications icon
class TechnicianAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const TechnicianAppBar({
    super.key,
    this.onLogoTap,
    this.onNotificationsTap,
    this.onMessagesTap,
  });

  final VoidCallback? onLogoTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onMessagesTap;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark      = Theme.of(context).brightness == Brightness.dark;
    final unread      = ref.watch(unreadNotificationsCountProvider);
    final pointsAsync = ref.watch(techPointsProvider);
    final cms         = ref.watch(cmsBrandingProvider).asData?.value
                        ?? CmsSettings.defaults;

    return AppBar(
      backgroundColor:          isDark ? AppColors.darkCard : AppColors.lightCard,
      surfaceTintColor:         Colors.transparent,
      elevation:                0,
      scrolledUnderElevation:   0,
      centerTitle:              true,
      automaticallyImplyLeading: false,

      // ── RIGHT (leading in RTL) — Logo ──────────────────────────────────
      leading: GestureDetector(
        onTap: onLogoTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Container(
            decoration: BoxDecoration(
              shape:    BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFFFFD700), Color(0xFFD4960A)],
                begin:  Alignment.topLeft,
                end:    Alignment.bottomRight,
              ),
              boxShadow: AppDesign.goldShadow(opacity: 0.30),
            ),
            child: cms.logoUrl != null
                ? ClipOval(
                    child: Image.network(
                      cms.logoUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const Icon(Icons.handyman_rounded, color: Colors.white, size: 18),
                    ),
                  )
                : const Icon(Icons.handyman_rounded, color: Colors.white, size: 18),
          ),
        ),
      ),

      // ── CENTER — Points balance chip ────────────────────────────────────
      title: pointsAsync.when(
        loading: () => const _PointsChip(loading: true),
        error:   (_, __) => const SizedBox.shrink(),
        data: (pts) => GestureDetector(
          onTap: () => context.push(RoutePaths.technicianWallet),
          child: _PointsChip(
            available: pts.available,
            low:       pts.available < 200,
          ),
        ),
      ),

      // ── LEFT (actions in RTL) — Messages + Notifications ───────────────
      actions: [
        _IconBtn(
          icon:  Icons.chat_bubble_outline_rounded,
          badge: 0,
          onTap: onMessagesTap ?? () => context.push(RoutePaths.conversations),
        ),
        _IconBtn(
          icon:  Icons.notifications_none_rounded,
          badge: unread,
          onTap: onNotificationsTap ?? () => context.push(RoutePaths.notifications),
        ),
        const SizedBox(width: 6),
      ],
    );
  }
}

// ── Points chip ─────────────────────────────────────────────────────────────

class _PointsChip extends StatelessWidget {
  const _PointsChip({this.available, this.low = false, this.loading = false});
  final int?  available;
  final bool  low;
  final bool  loading;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color  = low ? AppColors.destructive : AppColors.gold;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: isDark ? 0.20 : 0.12),
        borderRadius: BorderRadius.circular(AppDesign.radiusFull),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: loading
          ? SizedBox(
              width: 18, height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: AppColors.gold.withValues(alpha: 0.6),
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (low)
                  const Icon(Icons.warning_rounded,
                      color: AppColors.destructive, size: 15)
                else
                  const Icon(Icons.stars_rounded,
                      color: AppColors.gold, size: 15),
                const SizedBox(width: 6),
                Text(
                  '$available نقطة',
                  style: TextStyle(
                    color:      color,
                    fontSize:   13.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
    );
  }
}

// ── Icon button with optional badge ──────────────────────────────────────────

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.badge, required this.onTap});
  final IconData icon;
  final int      badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? AppColors.darkMuted : AppColors.lightMuted,
              ),
              child: Icon(icon, size: 20),
            ),
            if (badge > 0)
              Positioned(
                top: -2, right: -2,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    color:        AppColors.destructive,
                    borderRadius: BorderRadius.circular(AppDesign.radiusFull),
                    border: Border.all(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      width: 1.5,
                    ),
                  ),
                  child: Text(
                    badge > 99 ? '99+' : '$badge',
                    style: const TextStyle(
                      fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
