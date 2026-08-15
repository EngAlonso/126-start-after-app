import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';

/// The four content tabs the bottom nav controls.
/// The centre FAB (+) navigates but does NOT switch a tab.
enum CustomerNavTab {
  home(icon: Icons.home_rounded, outlineIcon: Icons.home_outlined, label: 'الرئيسية'),
  myPage(icon: Icons.dashboard_rounded, outlineIcon: Icons.dashboard_outlined, label: 'صفحتي'),
  requests(icon: Icons.receipt_long_rounded, outlineIcon: Icons.receipt_long_outlined, label: 'طلباتي'),
  myAccount(icon: Icons.person_rounded, outlineIcon: Icons.person_outline_rounded, label: 'حسابي');

  const CustomerNavTab({required this.icon, required this.outlineIcon, required this.label});
  final IconData icon;
  final IconData outlineIcon;
  final String label;
}

// ── Keep the old enum alive so existing imports don't break ──────────────────
typedef HomeNavDestination = CustomerNavTab;

/// Premium bottom navigation bar with a large central FAB (+) for creating
/// new service requests, permanently visible and attached to the bottom safe area.
///
/// The Home tab shows the Fnashha brand logo (from CMS) instead of a generic
/// home icon when a logo URL is configured — falls back to [Icons.home_rounded].
///
/// Layout (5 visual slots in RTL order):
///   Home  |  My Page  |  [BIG FAB]  |  Requests  |  My Account
class CustomerBottomNavBar extends ConsumerWidget {
  const CustomerBottomNavBar({
    super.key,
    required this.selectedTab,
    required this.onTabSelected,
    required this.onFabTap,
    this.badgeCounts = const {},
  });

  final CustomerNavTab selectedTab;
  final ValueChanged<CustomerNavTab> onTabSelected;
  final VoidCallback onFabTap;
  final Map<CustomerNavTab, int> badgeCounts;

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
            children: [
              // Home — shows brand logo when CMS has one configured
              Expanded(
                child: _NavItem(
                  tab:        CustomerNavTab.home,
                  selected:   selectedTab,
                  badgeCount: badgeCounts[CustomerNavTab.home] ?? 0,
                  logoUrl:    cms.logoUrl,
                  onTap:      () => onTabSelected(CustomerNavTab.home),
                ),
              ),
              // My Page
              Expanded(
                child: _NavItem(
                  tab:        CustomerNavTab.myPage,
                  selected:   selectedTab,
                  badgeCount: badgeCounts[CustomerNavTab.myPage] ?? 0,
                  onTap:      () => onTabSelected(CustomerNavTab.myPage),
                ),
              ),
              // Centre FAB
              _CenterFab(onTap: onFabTap),
              // Requests
              Expanded(
                child: _NavItem(
                  tab:        CustomerNavTab.requests,
                  selected:   selectedTab,
                  badgeCount: badgeCounts[CustomerNavTab.requests] ?? 0,
                  onTap:      () => onTabSelected(CustomerNavTab.requests),
                ),
              ),
              // My Account
              Expanded(
                child: _NavItem(
                  tab:        CustomerNavTab.myAccount,
                  selected:   selectedTab,
                  badgeCount: badgeCounts[CustomerNavTab.myAccount] ?? 0,
                  onTap:      () => onTabSelected(CustomerNavTab.myAccount),
                ),
              ),
            ],
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

  final CustomerNavTab tab;
  final CustomerNavTab selected;
  final VoidCallback   onTap;
  final int            badgeCount;
  /// When non-null AND this is the home tab, renders a circular brand logo
  /// instead of the generic home icon.
  final String?        logoUrl;

  @override
  Widget build(BuildContext context) {
    final isSelected   = tab == selected;
    final useLogoImage = logoUrl != null && tab == CustomerNavTab.home;

    return GestureDetector(
      onTap:     onTap,
      behavior:  HitTestBehavior.opaque,
      child: Center(
        child: AnimatedContainer(
          duration: AppDesign.durationNormal,
          curve:    Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
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
                      top:   -4,
                      right: -6,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        padding:     const EdgeInsets.symmetric(horizontal: 3),
                        decoration: BoxDecoration(
                          color: AppColors.destructive,
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

// ── Centre FAB ────────────────────────────────────────────────────────────────

class _CenterFab extends StatefulWidget {
  const _CenterFab({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_CenterFab> createState() => _CenterFabState();
}

class _CenterFabState extends State<_CenterFab>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double>   _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync:    this,
      duration: const Duration(milliseconds: 100),
      lowerBound: 0.88,
      upperBound: 1.0,
      value: 1.0,
    );
    _scale = _ctrl;
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onTapDown(_) => _ctrl.reverse();
  void _onTapUp(_)   => _ctrl.forward();
  void _onTapCancel() => _ctrl.forward();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width:  72,
      height: 60,
      child: Center(
        child: GestureDetector(
          onTap:       widget.onTap,
          onTapDown:   _onTapDown,
          onTapUp:     _onTapUp,
          onTapCancel: _onTapCancel,
          child: ScaleTransition(
            scale: _scale,
            child: Container(
              width:  56,
              height: 56,
              decoration: BoxDecoration(
                shape:  BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFCF8F00)],
                  begin:  Alignment.topLeft,
                  end:    Alignment.bottomRight,
                ),
                boxShadow: AppDesign.goldShadow(opacity: 0.40),
              ),
              child: const Icon(Icons.add_rounded, color: Colors.white, size: 30),
            ),
          ),
        ),
      ),
    );
  }
}
