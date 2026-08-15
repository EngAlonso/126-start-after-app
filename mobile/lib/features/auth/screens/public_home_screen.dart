import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../home/widgets/hero_banner_carousel.dart';
import '../../home/widgets/services_section.dart';

/// Guest home screen — shown to unauthenticated users.
///
/// Lets guests freely browse: home content, banners, services grid,
/// and how-it-works overview. Protected actions (request service, wallet,
/// etc.) show a [_LoginPromptSheet] instead of navigating away.
class PublicHomeScreen extends ConsumerStatefulWidget {
  const PublicHomeScreen({super.key});

  @override
  ConsumerState<PublicHomeScreen> createState() => _PublicHomeScreenState();
}

class _PublicHomeScreenState extends ConsumerState<PublicHomeScreen>
    with SingleTickerProviderStateMixin {
  int _selectedTab = 0; // 0=home 1=services

  // ── Entrance animation ──────────────────────────────────────────────────────
  late final AnimationController _animCtrl;
  late final List<Animation<double>> _fades;
  late final List<Animation<Offset>> _slides;
  static const _kSections = 5;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync:    this,
      duration: const Duration(milliseconds: 1200),
    )..forward();
    _fades = List.generate(_kSections, (i) {
      final start = (i * 0.12).clamp(0.0, 1.0);
      final end   = (start + 0.45).clamp(0.0, 1.0);
      return CurvedAnimation(
        parent: _animCtrl,
        curve:  Interval(start, end, curve: Curves.easeOut),
      );
    });
    _slides = List.generate(_kSections, (i) {
      final start = (i * 0.12).clamp(0.0, 1.0);
      final end   = (start + 0.45).clamp(0.0, 1.0);
      return Tween<Offset>(begin: const Offset(0, 0.10), end: Offset.zero)
          .animate(CurvedAnimation(
        parent: _animCtrl,
        curve:  Interval(start, end, curve: Curves.easeOut),
      ));
    });
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Widget _animated(int i, Widget child) => FadeTransition(
        opacity: _fades[i],
        child:   SlideTransition(position: _slides[i], child: child),
      );

  void _showLoginPrompt(String reason) {
    showModalBottomSheet(
      context:        context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder:        (_) => _LoginPromptSheet(reason: reason),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cms    = ref.watch(cmsBrandingProvider).asData?.value
                   ?? CmsSettings.defaults;

    return Scaffold(
      body: Stack(
        children: [
          // ── Gold gradient backdrop ─────────────────────────────────────
          Positioned(
            top:   0,
            left:  0,
            right: 0,
            child: Container(
              height: 240,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin:  Alignment.topCenter,
                  end:    Alignment.bottomCenter,
                  colors: isDark
                      ? [const Color(0xFF1F1700), AppColors.darkBackground]
                      : [const Color(0xFFFEF3C5), AppColors.lightBackground],
                ),
              ),
            ),
          ),

          // ── Scrollable content ─────────────────────────────────────────
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              color:       AppColors.gold,
              strokeWidth: 2.5,
              onRefresh:   () async =>
                  Future.delayed(const Duration(milliseconds: 600)),
              child: CustomScrollView(
                physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics(),
                ),
                slivers: [

                  // 0 — Guest header
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                    sliver: SliverToBoxAdapter(
                      child: _animated(0, _GuestHeader(
                        cms:           cms,
                        onLoginTap:    () => context.push(RoutePaths.login),
                        onRegisterTap: () => context.push(RoutePaths.registerChoice),
                      )),
                    ),
                  ),

                  // 1 — Banner carousel
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
                    sliver: SliverToBoxAdapter(
                      child: _animated(1, const HeroBannerCarousel()),
                    ),
                  ),

                  // 2 — Services grid
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
                    sliver: SliverToBoxAdapter(
                      child: _animated(2, ServicesSection(
                        onViewAllTap: () => context.push(RoutePaths.services),
                        onServiceTap: (_) =>
                            _showLoginPrompt('اطلب خدمة من فنيين محترفين'),
                      )),
                    ),
                  ),

                  // 3 — How it works
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 34, 20, 0),
                    sliver: SliverToBoxAdapter(
                      child: _animated(3, const _HowItWorksSection()),
                    ),
                  ),

                  // 4 — Join CTA banner
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
                    sliver: SliverToBoxAdapter(
                      child: _animated(4, _JoinCtaBanner(
                        onTap: () => context.push(RoutePaths.registerChoice),
                      )),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),

      // ── Guest bottom nav ───────────────────────────────────────────────
      bottomNavigationBar: _GuestBottomNav(
        selectedIndex: _selectedTab,
        onTap: (i) {
          switch (i) {
            case 0:
              setState(() => _selectedTab = 0);
            case 1:
              setState(() => _selectedTab = 1);
              context.push(RoutePaths.services);
            case 2:
              _showLoginPrompt('أنشئ حسابك وابدأ طلب خدمة الآن');
            case 3:
              context.push(RoutePaths.login);
          }
        },
      ),
    );
  }
}

// ── Guest header ──────────────────────────────────────────────────────────────

class _GuestHeader extends StatelessWidget {
  const _GuestHeader({
    required this.cms,
    required this.onLoginTap,
    required this.onRegisterTap,
  });
  final CmsSettings cms;
  final VoidCallback onLoginTap;
  final VoidCallback onRegisterTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Logo mark
        Container(
          width:  44,
          height: 44,
          decoration: BoxDecoration(
            shape:    BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFFFFD700), Color(0xFFE8A000)],
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
                        const Icon(Icons.handyman_rounded, color: Colors.white, size: 22),
                  ),
                )
              : const Icon(Icons.handyman_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 12),

        // Brand name + tagline
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                cms.appName,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              Text(
                'خدمات منزلية احترافية',
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),

        // Login CTA
        TextButton(
          onPressed: onLoginTap,
          style: TextButton.styleFrom(
            backgroundColor: AppColors.gold,
            foregroundColor: Colors.white,
            padding:         const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            shape:           RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDesign.radiusFull),
            ),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text(
            'دخول',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

// ── How it works ──────────────────────────────────────────────────────────────

class _HowItWorksSection extends StatelessWidget {
  const _HowItWorksSection();

  static const _steps = [
    _Step(
      icon:    Icons.search_rounded,
      title:   'اختر الخدمة',
      subtitle: 'تصفّح أكثر من ١٠٠ خدمة وحدد احتياجك',
      color:   Color(0xFF3B82F6),
    ),
    _Step(
      icon:    Icons.receipt_long_rounded,
      title:   'استقبل العروض',
      subtitle: 'يتقدم لك الفنيون بأفضل أسعارهم وتجاربهم',
      color:   AppColors.gold,
    ),
    _Step(
      icon:    Icons.check_circle_rounded,
      title:   'اختر واستمتع',
      subtitle: 'اختر أفضل عرض وتابع طلبك لحظة بلحظة',
      color:   Color(0xFF10B981),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'كيف يعمل التطبيق؟',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        Row(
          children: _steps.map((s) {
            final isLast = _steps.last == s;
            return Expanded(
              child: Row(
                children: [
                  Expanded(child: _StepTile(step: s, isDark: isDark)),
                  if (!isLast)
                    Container(
                      margin: const EdgeInsets.only(top: 16),
                      width: 12,
                      height: 2,
                      color: isDark
                          ? AppColors.darkBorder
                          : AppColors.lightCardBorder,
                    ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _Step {
  const _Step({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
}

class _StepTile extends StatelessWidget {
  const _StepTile({required this.step, required this.isDark});
  final _Step step;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width:  52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: step.color.withValues(alpha: isDark ? 0.18 : 0.12),
          ),
          child: Icon(step.icon, color: step.color, size: 24),
        ),
        const SizedBox(height: 10),
        Text(
          step.title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          step.subtitle,
          textAlign: TextAlign.center,
          maxLines:  2,
          style: TextStyle(
            fontSize: 10.5,
            color:    isDark
                ? AppColors.darkMutedForeground
                : AppColors.lightMutedForeground,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}

// ── Join CTA banner ───────────────────────────────────────────────────────────

class _JoinCtaBanner extends StatelessWidget {
  const _JoinCtaBanner({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppDesign.spaceLG),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFD700), Color(0xFFE8A000)],
            begin:  Alignment.topRight,
            end:    Alignment.bottomLeft,
          ),
          borderRadius: BorderRadius.circular(AppDesign.radiusXL),
          boxShadow:    AppDesign.goldShadow(),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'انضم لفنشها اليوم 🚀',
                    style: TextStyle(
                      fontSize:   18,
                      fontWeight: FontWeight.w800,
                      color:      Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'سجّل مجاناً وابدأ تجربتك الآن',
                    style: TextStyle(
                      fontSize: 13,
                      color:    Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color:        Colors.white.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(AppDesign.radiusFull),
              ),
              child: const Text(
                'إنشاء حساب',
                style: TextStyle(
                  color:      Colors.white,
                  fontSize:   13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Guest bottom nav ──────────────────────────────────────────────────────────

class _GuestBottomNav extends StatelessWidget {
  const _GuestBottomNav({
    required this.selectedIndex,
    required this.onTap,
  });
  final int selectedIndex;
  final ValueChanged<int> onTap;

  static const _items = [
    _NavItem(icon: Icons.home_rounded,            outlineIcon: Icons.home_outlined,                label: 'الرئيسية'),
    _NavItem(icon: Icons.grid_view_rounded,       outlineIcon: Icons.grid_view_outlined,           label: 'الخدمات'),
    _NavItem(icon: Icons.add_circle_rounded,      outlineIcon: Icons.add_circle_outline_rounded,   label: 'طلب جديد'),
    _NavItem(icon: Icons.person_rounded,          outlineIcon: Icons.person_outline_rounded,       label: 'حسابي'),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
            children: List.generate(_items.length, (i) {
              final item       = _items[i];
              final isSelected = i == selectedIndex;
              final isLocked   = i >= 2; // request + profile need auth

              return Expanded(
                child: GestureDetector(
                  onTap:     () => onTap(i),
                  behavior:  HitTestBehavior.opaque,
                  child: Center(
                    child: AnimatedContainer(
                      duration: AppDesign.durationNormal,
                      curve:    Curves.easeOut,
                      padding:  const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.gold.withValues(alpha: 0.14)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Icon(
                                isSelected ? item.icon : item.outlineIcon,
                                size:  21,
                                color: isSelected
                                    ? AppColors.gold
                                    : Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                              ),
                              if (isLocked)
                                Positioned(
                                  top:   -3,
                                  right: -5,
                                  child: Container(
                                    width:  12,
                                    height: 12,
                                    decoration: BoxDecoration(
                                      color:  AppColors.gold.withValues(alpha: 0.9),
                                      shape:  BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.lock_rounded,
                                      size:  7,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          AnimatedDefaultTextStyle(
                            duration: AppDesign.durationNormal,
                            style: TextStyle(
                              fontSize:   10,
                              fontWeight: isSelected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: isSelected
                                  ? AppColors.gold
                                  : Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                            ),
                            child: Text(
                              item.label,
                              maxLines:  1,
                              overflow:  TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({
    required this.icon,
    required this.outlineIcon,
    required this.label,
  });
  final IconData icon;
  final IconData outlineIcon;
  final String label;
}

// ── Login prompt bottom sheet ─────────────────────────────────────────────────

class _LoginPromptSheet extends StatelessWidget {
  const _LoginPromptSheet({required this.reason});
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        AppDesign.spaceXL,
        AppDesign.spaceLG,
        AppDesign.spaceXL,
        AppDesign.spaceXL + MediaQuery.viewInsetsOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color:        Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppDesign.radiusXXL),
        ),
        boxShadow: [
          BoxShadow(
            color:      Colors.black.withValues(alpha: 0.12),
            blurRadius: 32,
            offset:     const Offset(0, -8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width:        40,
            height:       4,
            decoration:   BoxDecoration(
              color:        Colors.black12,
              borderRadius: BorderRadius.circular(AppDesign.radiusFull),
            ),
          ),
          const SizedBox(height: AppDesign.spaceLG),

          // Icon
          Container(
            width:  72,
            height: 72,
            decoration: BoxDecoration(
              color:  AppColors.gold.withValues(alpha: 0.12),
              shape:  BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_open_rounded,
              color: AppColors.gold,
              size:  34,
            ),
          ),
          const SizedBox(height: AppDesign.spaceMD),

          const Text(
            'تسجيل الدخول مطلوب',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            reason,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color:    Theme.of(context).colorScheme.onSurfaceVariant,
              height:   1.5,
            ),
          ),

          const SizedBox(height: AppDesign.spaceLG),

          // Login button
          SizedBox(
            width:  double.infinity,
            height: 50,
            child:  ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.push(RoutePaths.login);
              },
              child: const Text(
                'تسجيل الدخول',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),

          const SizedBox(height: 10),

          // Register link
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.push(RoutePaths.registerChoice);
            },
            child: const Text(
              'إنشاء حساب جديد مجاناً',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
