import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../models/user_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../auth/providers/catalog_providers.dart';
import '../../home/screens/my_account_tab.dart';
import '../../notifications/providers/notifications_provider.dart';
import '../providers/tech_providers.dart';
import '../providers/tech_sse_provider.dart';
import '../widgets/points_balance_card.dart';
import '../widgets/tech_app_bar.dart';
import '../widgets/tech_bottom_nav_bar.dart';
import '../widgets/tech_request_card.dart';
import 'tech_my_page_tab.dart';
import 'tech_requests_tab.dart';
import 'tech_wallet_tab.dart';

/// Technician home shell — Phase 3 redesign.
///
/// Persistent 5-tab shell with:
///   • [TechnicianAppBar] — logo (right) / points chip (center) / icons (left)
///   • [IndexedStack] — preserves each tab's scroll & provider state
///   • [TechBottomNavBar] — permanently visible, never hidden
///
/// Tab mapping:
///   0 → Home (landing: greeting + points card + available requests)
///   1 → My Page (dashboard: 3 cards + full lists)
///   2 → Requests (paginated available requests)
///   3 → Wallet (points balance + transactions)
///   4 → My Account (profile / settings / logout)
class TechnicianHomeScreen extends ConsumerStatefulWidget {
  const TechnicianHomeScreen({super.key});

  @override
  ConsumerState<TechnicianHomeScreen> createState() =>
      _TechnicianHomeScreenState();
}

class _TechnicianHomeScreenState extends ConsumerState<TechnicianHomeScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    // Anchor SSE connections for real-time updates.
    ref.watch(techSseProvider);
    ref.watch(notificationsSseProvider);
    final unreadCount = ref.watch(unreadNotificationsCountProvider);

    return Scaffold(
      appBar: TechnicianAppBar(
        onLogoTap: () => setState(() => _selectedIndex = 0),
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: const [
          _TechHomeContent(),  // Home tab
          TechMyPageTab(),     // My Page tab
          TechRequestsTab(),   // Requests tab
          TechWalletTab(),     // Wallet tab
          MyAccountTab(),      // My Account tab
        ],
      ),
      bottomNavigationBar: TechBottomNavBar(
        selectedTab: TechNavTab.values[_selectedIndex],
        onTabSelected: (tab) =>
            setState(() => _selectedIndex = tab.index),
        badgeCounts: {
          if (unreadCount > 0) TechNavTab.myAccount: unreadCount,
        },
      ),
    );
  }
}

// ── Home tab content ──────────────────────────────────────────────────────────

/// Simplified home landing shown on tab 0.
/// Shows a greeting, the points balance card, and the latest 5 available
/// requests. Tapping any item navigates to the full detail; tapping "عرض الكل"
/// switches to the Requests tab (via the parent shell would require a callback,
/// so we push the dedicated screen instead).
class _TechHomeContent extends ConsumerWidget {
  const _TechHomeContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final UserModel? user = switch (authState.asData?.value) {
      Authenticated(:final user) => user,
      _ => null,
    };

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // ── Gradient header ───────────────────────────────────────────────
        SliverToBoxAdapter(child: _HomeHeader(user: user)),

        // ── Points balance card ───────────────────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          sliver: SliverToBoxAdapter(
            child: PointsBalanceCard(
              onTap: () => context.push(RoutePaths.technicianWallet),
            ),
          ),
        ),

        // ── Available requests header ─────────────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 4),
          sliver: SliverToBoxAdapter(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'الطلبات المتاحة',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                ),
                TextButton(
                  onPressed: () =>
                      context.push(RoutePaths.technicianRequests),
                  child: const Text(
                    'عرض الكل',
                    style: TextStyle(
                        color: AppColors.gold, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Latest 5 available requests ───────────────────────────────────
        _LatestRequestsSliver(),

        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context) {
    final isDark    = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end:   Alignment.bottomCenter,
          colors: isDark
              ? [const Color(0xFF1F1700), AppColors.darkBackground]
              : [const Color(0xFFFEF3D5), AppColors.lightBackground],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Row(
            children: [
              _Avatar(user: user),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'أهلاً،',
                      style: textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                    ),
                    Text(
                      user?.fullName ?? '...',
                      style: textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    _StatusChip(user: user),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context) {
    final imageUrl = user?.profileImage;
    return Container(
      width: 56, height: 56,
      decoration: BoxDecoration(
        shape:  BoxShape.circle,
        border: Border.all(color: AppColors.gold, width: 2.5),
        color:  AppColors.gold.withValues(alpha: 0.12),
      ),
      child: ClipOval(
        child: imageUrl?.isNotEmpty == true
            ? Image.network(imageUrl!, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    const Icon(Icons.person_rounded, color: AppColors.gold, size: 28))
            : const Icon(Icons.person_rounded, color: AppColors.gold, size: 28),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context) {
    final status = user?.status ?? 'approved';
    final (label, color) = switch (status) {
      'approved' => ('فني معتمد', AppColors.chartGreen),
      'pending'  => ('قيد المراجعة', AppColors.gold),
      _          => ('فني', AppColors.gold),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.verified_rounded, size: 11, color: color),
        const SizedBox(width: 3),
        Text(label,
            style: TextStyle(
                fontSize: 11, color: color, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _LatestRequestsSliver extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final requestsAsync = ref.watch(techLatestRequestsProvider);
    final servicesAsync = ref.watch(servicesProvider);
    final areasAsync    = ref.watch(areasProvider);
    final govAsync      = ref.watch(governoratesProvider);

    return requestsAsync.when(
      loading: () => const SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: CircularProgressIndicator(color: AppColors.gold),
          ),
        ),
      ),
      error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (requests) {
        if (requests.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color:        isDark ? AppColors.darkCard : AppColors.lightCard,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                      color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.search_off_rounded,
                        color: AppColors.gold, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'لا توجد طلبات متاحة حالياً',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'ستظهر هنا الطلبات الجديدة المطابقة لتخصصاتك',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final req = requests[i];
                final svc = servicesAsync.asData?.value
                    .where((s) => s.id == req.serviceId).firstOrNull;
                final area = areasAsync.asData?.value
                    .where((a) => a.id == req.areaId).firstOrNull;
                final gov = govAsync.asData?.value
                    .where((g) => g.id == req.governorateId).firstOrNull;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TechRequestCard(
                    request:         req,
                    serviceName:     svc?.nameAr ?? '...',
                    areaName:        area?.nameAr ?? '...',
                    governorateName: gov?.nameAr ?? '...',
                    onTap: () => context.push(
                        RoutePaths.technicianRequestDetail(req.id)),
                  ),
                );
              },
              childCount: requests.length,
            ),
          ),
        );
      },
    );
  }
}

extension _IterableExt<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
