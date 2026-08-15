import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/empty_state_widget.dart';
import '../../../widgets/common/skeleton_widget.dart';
import '../../auth/providers/catalog_providers.dart';
import '../../requests/providers/requests_list_provider.dart';
import '../../requests/widgets/request_list_card.dart';

/// Requests tab embedded in the main customer shell.
///
/// Displays the customer's own service requests under four simplified tabs:
///   Open  |  In Progress  |  Solved  |  Closed
///
/// Reuses the existing [myRequestsProvider] and [RequestListCard] widget.
/// Each tab switch calls [setFilter] on the provider — data is re-fetched
/// from the backend rather than cached, matching the existing screen behaviour.
class RequestsTab extends ConsumerStatefulWidget {
  const RequestsTab({super.key});

  @override
  ConsumerState<RequestsTab> createState() => _RequestsTabState();
}

class _RequestsTabState extends ConsumerState<RequestsTab>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  final _scrollCtrl = ScrollController();

  // 4-tab simplified mapping
  static const _filters = [
    RequestFilter.open,       // Open (pending)
    RequestFilter.inProgress, // In Progress
    RequestFilter.completed,  // Solved
    RequestFilter.cancelled,  // Closed
  ];

  static const _tabLabels = ['مفتوحة', 'قيد التنفيذ', 'مكتملة', 'مغلقة'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
    _tabCtrl.addListener(_onTabChange);
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _tabCtrl.removeListener(_onTabChange);
    _tabCtrl.dispose();
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onTabChange() {
    if (_tabCtrl.indexIsChanging) {
      ref.read(myRequestsProvider.notifier).setFilter(_filters[_tabCtrl.index]);
    }
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      ref.read(myRequestsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark      = Theme.of(context).brightness == Brightness.dark;
    final asyncState  = ref.watch(myRequestsProvider);
    final servicesAsync = ref.watch(servicesProvider);

    return Column(
      children: [
        // ── Tab bar ────────────────────────────────────────────────────────
        Container(
          color: isDark ? AppColors.darkCard : AppColors.lightCard,
          child: TabBar(
            controller:          _tabCtrl,
            labelColor:          AppColors.gold,
            unselectedLabelColor: isDark
                ? AppColors.darkMutedForeground
                : AppColors.lightMutedForeground,
            indicatorColor:      AppColors.gold,
            indicatorWeight:     2.5,
            labelStyle:          const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
            tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
          ),
        ),

        const SizedBox(height: 4),

        // ── List / states ─────────────────────────────────────────────────
        Expanded(
          child: asyncState.when(
            loading: () => const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 24),
              child: SkeletonList(count: 5),
            ),
            error: (e, _) => _RequestsError(
              onRetry: () => ref.read(myRequestsProvider.notifier).refresh(),
            ),
            data: (data) {
              final visible = data.visibleItems;
              final serviceNames = servicesAsync.maybeWhen(
                data: (list) => {for (final s in list) s.id: s.nameAr},
                orElse: () => <int, String>{},
              );

              if (visible.isEmpty) {
                return RefreshIndicator(
                  color: AppColors.gold,
                  onRefresh: () =>
                      ref.read(myRequestsProvider.notifier).refresh(),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: 400,
                        child: EmptyStateWidget(
                          icon:        Icons.receipt_long_rounded,
                          title:       'لا توجد طلبات ${_tabLabels[_tabCtrl.index]}',
                          subtitle:    'اضغط على زر + لإنشاء طلب خدمة جديد',
                          actionLabel: 'إنشاء طلب جديد',
                          onAction:    () => context.push(RoutePaths.createRequest),
                        ),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                color: AppColors.gold,
                onRefresh: () =>
                    ref.read(myRequestsProvider.notifier).refresh(),
                child: ListView.separated(
                  controller: _scrollCtrl,
                  physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: visible.length + (data.hasMore ? 1 : 0),
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: AppDesign.spaceSM),
                  itemBuilder: (context, i) {
                    if (i >= visible.length) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(
                          child: SizedBox(
                            width:  22,
                            height: 22,
                            child:  CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: AppColors.gold,
                            ),
                          ),
                        ),
                      );
                    }
                    final request = visible[i];
                    return RequestListCard(
                      request:     request,
                      serviceName: serviceNames[request.serviceId] ?? 'خدمة',
                      onTap:       () => context.push(
                        RoutePaths.requestDetail(request.id),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── Error state ────────────────────────────────────────────────────────────────

class _RequestsError extends StatelessWidget {
  const _RequestsError({required this.onRetry});
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
            const Text('تعذر تحميل الطلبات',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
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
