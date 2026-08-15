import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// Shared wallet UI primitives used by both the customer wallet screen
/// ([WalletScreen], loyalty coins) and the technician wallet screen
/// ([TechWalletScreen], commission points). Extracted so the two — which
/// read from entirely separate backend systems but share the same visual
/// language — don't duplicate their tab bar / empty / error chrome.

/// Sticky tab bar used under a [NestedScrollView]'s [SliverAppBar].
class WalletTabBarDelegate extends SliverPersistentHeaderDelegate {
  WalletTabBarDelegate({required this.tabBar, required this.isDark});

  final TabBar tabBar;
  final bool isDark;

  @override
  double get minExtent => tabBar.preferredSize.height + 1;
  @override
  double get maxExtent => tabBar.preferredSize.height + 1;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      child: Column(
        children: [
          tabBar,
          Divider(
            height: 1,
            thickness: 1,
            color:
                isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(WalletTabBarDelegate oldDelegate) =>
      oldDelegate.isDark != isDark;
}

/// Centered icon + title + subtitle placeholder for an empty list.
class WalletEmptyState extends StatelessWidget {
  const WalletEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.10),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.gold, size: 36),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: textTheme.bodySmall?.copyWith(
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Centered error message with a retry action, used for both the balance
/// header and any tab body that failed to load.
class WalletErrorCard extends StatelessWidget {
  const WalletErrorCard({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off_rounded,
              color: AppColors.destructive, size: 40),
          const SizedBox(height: 12),
          Text(
            message,
            style: textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, color: AppColors.gold),
            label: const Text('إعادة المحاولة',
                style: TextStyle(color: AppColors.gold)),
          ),
        ],
      ),
    );
  }
}
