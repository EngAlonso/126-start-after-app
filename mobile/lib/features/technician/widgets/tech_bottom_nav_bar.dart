import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';

/// The five content tabs the technician bottom nav controls.
enum TechNavTab {
  home(icon: Icons.home_rounded, outlineIcon: Icons.home_outlined, label: 'الرئيسية'),
  myPage(icon: Icons.dashboard_rounded, outlineIcon: Icons.dashboard_outlined, label: 'صفحتي'),
  requests(icon: Icons.list_alt_rounded, outlineIcon: Icons.list_alt_outlined, label: 'الطلبات'),
  wallet(icon: Icons.account_balance_wallet_rounded,
      outlineIcon: Icons.account_balance_wallet_outlined, label: 'محفظتي'),
  myAccount(icon: Icons.person_rounded, outlineIcon: Icons.person_outline_rounded, label: 'حسابي');

  const TechNavTab({required this.icon, required this.outlineIcon, required this.label});
  final IconData icon;
  final IconData outlineIcon;
  final String label;
}

/// Permanent 5-item bottom navigation bar for the technician shell.
///
/// The Home tab shows the Fnashha brand logo (from CMS) instead of a generic
/// home icon when a logo URL is configured — falls back to [Icons.home_rounded].
///
/// Never hides. Never moves. Permanently attached to the bottom safe area.
class TechBottomNavBar extends ConsumerWidget {
  const TechBottomNavBar({
    super.key,
    required this.selectedTab,
    required this.onTabSelected,
    this.badgeCounts = const {},
  });

  final TechNavTab                selectedTab;
  final ValueChanged<TechNavTab>  onTabSelected;
  final Map<TechNavTab, int>      badgeCounts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cms    = ref.watch(cmsBrandingProvider).asData?.value ?? CmsSettings.defaults;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
        boxShadow: AppDesign.bottomNavShadow(isDark: isDark),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: TechNavTab.values.map((tab) {
              return Expanded(
                child: _NavItem(
                  tab:        tab,
                  selected:   selectedTab,
                  badgeCount: badgeCounts[tab] ?? 0,
                  logoUrl:    tab == TechNavTab.home ? cms.logoUrl : null,
                  onTap:      () => onTabSelected(tab),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

// ── Regular nav item ──────────────────────────────────────────────────────────

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tab,
    required this.selected,
    required this.onTap,
    this.badgeCount = 0,
    this.logoUrl,
  });

  final TechNavTab   tab;
  final TechNavTab   selected;
  final VoidCallback onTap;
  final int          badgeCount;
  /// When non-null AND this is the home tab, renders a circular brand logo
  /// instead of the generic home icon.
  final String?      logoUrl;

  @override
  Widget build(BuildContext context) {
    final isSelected   = tab == selected;
    final useLogoImage = logoUrl != null && tab == TechNavTab.home;

    return GestureDetector(
      onTap:    onTap,
      behavior: HitTestBehavior.opaque,
      child: Center(
        child: AnimatedContainer(
          duration: AppDesign.durationNormal,
          curve:    Curves.easeOut,
          padding:  const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.gold.withValues(alpha: 0.13)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  // ── Icon or brand logo ──────────────────────────────────
                  if (useLogoImage)
                    _LogoImage(url: logoUrl!, isSelected: isSelected)
                  else
                    Icon(
                      isSelected ? tab.icon : tab.outlineIcon,
                      size:  21,
                      color: isSelected
                          ? AppColors.gold
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  // ── Badge dot ───────────────────────────────────────────
                  if (badgeCount > 0)
                    Positioned(
                      top: -4, right: -6,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        padding:     const EdgeInsets.symmetric(horizontal: 3),
                        decoration: BoxDecoration(
                          color:        AppColors.destructive,
                          borderRadius: BorderRadius.circular(AppDesign.radiusFull),
                          border: Border.all(
                            color: Theme.of(context).scaffoldBackgroundColor,
                            width: 1.5,
                          ),
                        ),
                        child: Text(
                          badgeCount > 99 ? '99+' : '$badgeCount',
                          style: const TextStyle(
                            fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: AppDesign.durationNormal,
                style: TextStyle(
                  fontSize:   9.5,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected
                      ? AppColors.gold
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                child: Text(tab.label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Brand logo image (home tab) ───────────────────────────────────────────────

/// Circular brand logo loaded from [url].
/// Shows a gold ring when [isSelected]; fades to 60 % opacity when inactive.
class _LogoImage extends StatelessWidget {
  const _LogoImage({required this.url, required this.isSelected});

  final String url;
  final bool   isSelected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppDesign.durationNormal,
      width:  24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: isSelected
              ? AppColors.gold
              : AppColors.gold.withValues(alpha: 0.0),
          width: 1.5,
        ),
      ),
      child: ClipOval(
        child: Opacity(
          opacity: isSelected ? 1.0 : 0.55,
          child: Image.network(
            url,
            width:  24,
            height: 24,
            fit:    BoxFit.cover,
            errorBuilder: (_, __, ___) => Icon(
              Icons.home_rounded,
              size:  21,
              color: isSelected
                  ? AppColors.gold
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}
