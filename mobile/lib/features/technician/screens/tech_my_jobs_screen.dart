import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/empty_state_widget.dart';
import '../../../widgets/common/skeleton_widget.dart';
import '../../auth/providers/catalog_providers.dart';
import '../providers/tech_job_providers.dart';
import '../widgets/tech_request_card.dart';

/// Phase 11B — Technician "My Jobs" screen.
///
/// Shows the three tabs: ongoing / completed / cancelled. Each tab reuses the
/// same [TechMyJobsNotifier] (switching via [TechMyJobsNotifier.switchTab]);
/// the list reuses [TechRequestCard] from Phase 11A and navigates to the new
/// [TechJobDetailScreen] (`/technician/jobs/:id`).
class TechMyJobsScreen extends ConsumerStatefulWidget {
  const TechMyJobsScreen({super.key});

  @override
  ConsumerState<TechMyJobsScreen> createState() => _TechMyJobsScreenState();
}

class _TechMyJobsScreenState extends ConsumerState<TechMyJobsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _scrollController = ScrollController();

  static const _tabs = TechMyJobsTab.values;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this)
      ..addListener(_onTabChanged);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _tabController
      ..removeListener(_onTabChanged)
      ..dispose();
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    ref
        .read(techMyJobsProvider.notifier)
        .switchTab(_tabs[_tabController.index]);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(techMyJobsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final jobsAsync = ref.watch(techMyJobsProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      body: NestedScrollView(
        headerSliverBuilder: (context, _) => [
          SliverAppBar(
            pinned: true,
            backgroundColor:
                isDark ? AppColors.darkBackground : AppColors.lightBackground,
            title: const Text(
              'مهامي',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            centerTitle: true,
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(48),
              child: _TabBar(controller: _tabController, isDark: isDark),
            ),
          ),
        ],
        body: jobsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: SkeletonList(count: 5),
          ),
          error: (e, _) => _ErrorState(
            message: e.toString().replaceFirst('Exception: ', ''),
            onRetry: () => ref.read(techMyJobsProvider.notifier).refresh(),
          ),
          data: (state) => RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () => ref.read(techMyJobsProvider.notifier).refresh(),
            child: state.items.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: 400,
                        child: EmptyStateWidget(
                          icon: switch (state.tab) {
                            TechMyJobsTab.ongoing   => Icons.work_outline_rounded,
                            TechMyJobsTab.completed => Icons.check_circle_outline_rounded,
                            TechMyJobsTab.cancelled => Icons.cancel_outlined,
                          },
                          title: switch (state.tab) {
                            TechMyJobsTab.ongoing   => 'لا توجد مهام نشطة',
                            TechMyJobsTab.completed => 'لا توجد مهام مكتملة بعد',
                            TechMyJobsTab.cancelled => 'لا توجد مهام ملغية',
                          },
                          subtitle: switch (state.tab) {
                            TechMyJobsTab.ongoing   => 'ستظهر هنا مهامك الجارية بعد قبول طلب',
                            TechMyJobsTab.completed => 'ستظهر هنا الطلبات التي أنهيتها بنجاح',
                            TechMyJobsTab.cancelled => 'ستظهر هنا الطلبات التي تم إلغاؤها',
                          },
                        ),
                      ),
                    ],
                  )
                : _JobList(
                    state: state,
                    scrollController: _scrollController,
                  ),
          ),
        ),
      ),
    );
  }
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

class _TabBar extends StatelessWidget {
  const _TabBar({required this.controller, required this.isDark});

  final TabController controller;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return TabBar(
      controller: controller,
      tabs: TechMyJobsTab.values
          .map((t) => Tab(text: t.labelAr))
          .toList(),
      labelColor: AppColors.gold,
      unselectedLabelColor:
          isDark ? AppColors.darkMutedForeground : AppColors.lightMutedForeground,
      indicatorColor: AppColors.gold,
      indicatorWeight: 2.5,
      labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500),
    );
  }
}

// ── Job list ──────────────────────────────────────────────────────────────────

class _JobList extends ConsumerWidget {
  const _JobList({required this.state, required this.scrollController});

  final TechMyJobsState state;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(servicesProvider);
    final areasAsync = ref.watch(areasProvider);
    final govAsync = ref.watch(governoratesProvider);

    return ListView.separated(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == state.items.length) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(color: AppColors.gold),
            ),
          );
        }

        final req = state.items[index];
        final svc = servicesAsync.asData?.value
            .where((s) => s.id == req.serviceId)
            .firstOrNull;
        final area = areasAsync.asData?.value
            .where((a) => a.id == req.areaId)
            .firstOrNull;
        final gov = govAsync.asData?.value
            .where((g) => g.id == req.governorateId)
            .firstOrNull;

        return TechRequestCard(
          request: req,
          serviceName: svc?.nameAr ?? '...',
          areaName: area?.nameAr ?? '...',
          governorateName: gov?.nameAr ?? '...',
          onTap: () => context.push(RoutePaths.technicianJobDetail(req.id)),
          onChatTap: req.selectedTechnicianId != null
              ? () => context.push(
                    RoutePaths.chat(req.id),
                    extra: {'serviceName': svc?.nameAr, 'status': req.status},
                  )
              : null,
        );
      },
    );
  }
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: 180,
              child: AppButton(label: 'إعادة المحاولة', onPressed: onRetry),
            ),
          ],
        ),
      ),
    );
  }
}
