import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../notifications/providers/notifications_provider.dart';
import '../widgets/customer_app_bar.dart';
import '../widgets/hero_banner_carousel.dart';
import '../widgets/home_bottom_nav_bar.dart';
import '../widgets/how_it_works_section.dart';
import '../widgets/section_header.dart';
import '../widgets/services_section.dart';
import 'my_account_tab.dart';
import 'my_page_tab.dart';
import 'requests_tab.dart';

/// Primary customer shell — replaces the old single-scroll home screen.
///
/// Architecture:
///   AppBar   : [CustomerAppBar]  — persistent on every tab
///   Body     : [IndexedStack]    — four tabs; state is preserved on switch
///   Bottom   : [CustomerBottomNavBar] — 4 items + center FAB
///
/// Tabs:
///   0 — Home (animated banner, services, how-it-works)
///   1 — My Page dashboard
///   2 — My Requests (Open / In Progress / Solved / Closed)
///   3 — My Account
///
/// The center FAB navigates to [CreateRequestScreen] (not a tab).
class CustomerHomeScreen extends ConsumerStatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  ConsumerState<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends ConsumerState<CustomerHomeScreen> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    // Anchor the SSE connection for the entire customer session.
    ref.watch(notificationsSseProvider);

    final unreadCount = ref.watch(unreadNotificationsCountProvider);

    return Scaffold(
      appBar: CustomerAppBar(
        onLogoTap:         () => setState(() => _selectedIndex = 0),
        onNotificationsTap: () => context.push(RoutePaths.notifications),
        onMessagesTap:      () => context.push(RoutePaths.conversations),
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: const [
          _HomeContent(),    // 0
          MyPageTab(),       // 1
          RequestsTab(),     // 2
          MyAccountTab(),    // 3
        ],
      ),
      bottomNavigationBar: CustomerBottomNavBar(
        selectedTab: CustomerNavTab.values[_selectedIndex],
        badgeCounts: {
          CustomerNavTab.requests: 0,
        },
        onTabSelected: (tab) => setState(() => _selectedIndex = tab.index),
        // FAB opens Services catalogue first; tapping a service there
        // navigates to CreateRequest with that service pre-selected.
        onFabTap:      () => context.push(RoutePaths.services),
      ),
    );
  }
}

// ── Home tab content ───────────────────────────────────────────────────────────
//
// Three sections in a single scrollable view:
//   1. Animated promotional banner carousel
//   2. Featured services (up to 6 — 2 rows × 3 columns)
//   3. "How It Works" visual flow
//
// The old search bar, FeaturedOffersSection, and LatestRequestsSection are
// intentionally removed per the Part 2 redesign specification.

class _HomeContent extends StatelessWidget {
  const _HomeContent();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RefreshIndicator(
      color:        AppColors.gold,
      strokeWidth:  2.5,
      onRefresh: () async =>
          Future<void>.delayed(const Duration(milliseconds: 600)),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          // ── Gradient header backdrop ────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              height: 8,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin:  Alignment.topCenter,
                  end:    Alignment.bottomCenter,
                  colors: isDark
                      ? [const Color(0xFF1F1700), AppColors.darkBackground]
                      : [const Color(0xFFFEF3D5), AppColors.lightBackground],
                ),
              ),
            ),
          ),

          // ── 1. Banner carousel ──────────────────────────────────────
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 0),
            sliver: SliverToBoxAdapter(child: HeroBannerCarousel()),
          ),

          // ── 2. Featured services ────────────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
            sliver: SliverToBoxAdapter(
              child: Builder(builder: (ctx) {
                return ServicesSection(
                  maxItems:      6,
                  onViewAllTap:  () => ctx.push(RoutePaths.services),
                  onServiceTap:  (_) => ctx.push(RoutePaths.services),
                );
              }),
            ),
          ),

          // ── 3. How it works ─────────────────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 32, 20, 36),
            sliver: SliverToBoxAdapter(
              child: Builder(builder: (ctx) {
                return HowItWorksSection(
                  onRequestTap: () => ctx.push(RoutePaths.createRequest),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
