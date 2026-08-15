import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../notifications/providers/notifications_provider.dart';
import '../../wallet/providers/wallet_provider.dart';

/// Persistent global app bar shown on every customer tab page.
///
/// Layout (RTL-aware — Flutter AppBar flips leading/actions in RTL):
///   • leading  → physical RIGHT → Fnashha logo button → returns to Home tab
///   • title    → CENTER → coins-balance chip → opens Wallet
///   • actions  → physical LEFT  → Messages icon, Notifications icon
class CustomerAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const CustomerAppBar({
    super.key,
    this.onLogoTap,          // overrides default → Home tab
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
    final isDark       = Theme.of(context).brightness == Brightness.dark;
    final unread       = ref.watch(unreadNotificationsCountProvider);
    final walletAsync  = ref.watch(walletProvider);
    final cms          = ref.watch(cmsBrandingProvider).asData?.value
                         ?? CmsSettings.defaults;

    return AppBar(
      backgroundColor:     isDark ? AppColors.darkCard : AppColors.lightCard,
      surfaceTintColor:    Colors.transparent,
      elevation:           0,
      scrolledUnderElevation: 0,
      centerTitle:         true,
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

      // ── CENTER — Coins balance ──────────────────────────────────────────
      title: walletAsync.when(
        loading: () => const _CoinsChip(loading: true),
        error:   (_, __) => const SizedBox.shrink(),
        data: (wallet) => GestureDetector(
          onTap: () => context.push(RoutePaths.wallet),
          child: _CoinsChip(
            coins:    wallet.availableCoins,
            coinName: wallet.coinName,
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

// ── Coins chip ─────────────────────────────────────────────────────────────────

class _CoinsChip extends StatelessWidget {
  const _CoinsChip({this.coins, this.coinName, this.loading = false});
  final int? coins;
  final String? coinName;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color:        AppColors.gold.withValues(alpha: isDark ? 0.20 : 0.12),
        borderRadius: BorderRadius.circular(AppDesign.radiusFull),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: 0.30),
        ),
      ),
      child: loading
          ? SizedBox(
              width:  18,
              height: 18,
              child:  CircularProgressIndicator(
                strokeWidth: 1.5,
                color: AppColors.gold.withValues(alpha: 0.6),
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.stars_rounded, color: AppColors.gold, size: 16),
                const SizedBox(width: 6),
                Text(
                  '$coins ${coinName ?? ''}',
                  style: const TextStyle(
                    color:      AppColors.gold,
                    fontSize:   13.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
    );
  }
}

// ── Icon button with optional badge ───────────────────────────────────────────

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.badge, required this.onTap});
  final IconData icon;
  final int badge;
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
              width:  36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? AppColors.darkMuted : AppColors.lightMuted,
              ),
              child: Icon(icon, size: 20),
            ),
            if (badge > 0)
              Positioned(
                top:   -2,
                right: -2,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  padding:     const EdgeInsets.symmetric(horizontal: 3),
                  decoration:  BoxDecoration(
                    color:         AppColors.destructive,
                    borderRadius:  BorderRadius.circular(AppDesign.radiusFull),
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
