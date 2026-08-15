import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../auth/providers/catalog_providers.dart';
import '../providers/tech_providers.dart';
import '../widgets/tech_request_card.dart';

/// Technician "Requests" tab — paginated list of service requests that are
/// available for the technician to submit offers on.
///
/// Matches the functionality of [TechRequestsScreen] but is designed to be
/// embedded inside the technician shell's [IndexedStack] rather than pushed
/// as a separate route, so it has no [Scaffold] or own [AppBar].
class TechRequestsTab extends ConsumerStatefulWidget {
  const TechRequestsTab({super.key});

  @override
  ConsumerState<TechRequestsTab> createState() => _TechRequestsTabState();
}

class _TechRequestsTabState extends ConsumerState<TechRequestsTab> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 220) {
      ref.read(techRequestsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final requestsAsync = ref.watch(techRequestsProvider);
    final currentFilter =
        requestsAsync.asData?.value.filter ?? TechRequestFilter.all;
    final servicesAsync = ref.watch(servicesProvider);
    final areasAsync    = ref.watch(areasProvider);
    final govAsync      = ref.watch(governoratesProvider);

    return CustomScrollView(
      controller: _scrollCtrl,
      physics:    const BouncingScrollPhysics(),
      slivers: [
        // ── Section title + service filter button ─────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          sliver: SliverToBoxAdapter(
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'الطلبات المتاحة',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                ),
                _ServiceFilterButton(),
              ],
            ),
          ),
        ),

        // ── Filter chips ──────────────────────────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
          sliver: SliverToBoxAdapter(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: TechRequestFilter.values.map((filter) {
                  final isSelected = currentFilter == filter;
                  return Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: AnimatedContainer(
                      duration: AppDesign.durationNormal,
                      child: ChoiceChip(
                        label: Text(filter.label),
                        selected: isSelected,
                        selectedColor: AppColors.gold.withValues(alpha: 0.20),
                        checkmarkColor: AppColors.gold,
                        labelStyle: TextStyle(
                          color: isSelected
                              ? AppColors.gold
                              : (isDark
                                  ? AppColors.darkMutedForeground
                                  : AppColors.lightMutedForeground),
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          fontSize: 12.5,
                        ),
                        side: BorderSide(
                          color: isSelected
                              ? AppColors.gold.withValues(alpha: 0.50)
                              : (isDark
                                  ? AppColors.darkBorder
                                  : AppColors.lightBorder),
                        ),
                        onSelected: (_) => ref
                            .read(techRequestsProvider.notifier)
                            .setFilter(filter),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ),

        // ── Request list ──────────────────────────────────────────────────
        requestsAsync.when(
          loading: () => const SliverFillRemaining(
            child: Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            ),
          ),
          error: (e, _) => SliverFillRemaining(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        color: AppColors.gold, size: 44),
                    const SizedBox(height: 12),
                    Text(
                      e.toString().replaceFirst('Exception: ', ''),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () =>
                          ref.invalidate(techRequestsProvider),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('إعادة المحاولة'),
                    ),
                  ],
                ),
              ),
            ),
          ),
          data: (state) {
            if (state.items.isEmpty) {
              return SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.search_off_rounded,
                            color: AppColors.gold, size: 52),
                        const SizedBox(height: 14),
                        const Text(
                          'لا توجد طلبات متاحة حالياً',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'ستظهر هنا الطلبات الجديدة المطابقة لتخصصاتك وموقعك',
                          style: TextStyle(
                            fontSize: 13,
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
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    // Load-more spinner
                    if (index == state.items.length) {
                      return state.isLoadingMore
                          ? const Padding(
                              padding: EdgeInsets.all(20),
                              child: Center(
                                child: CircularProgressIndicator(
                                    color: AppColors.gold, strokeWidth: 2.5),
                              ),
                            )
                          : const SizedBox.shrink();
                    }

                    final req = state.items[index];
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
                  childCount: state.items.length + 1, // +1 for load-more row
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

// ── Service filter icon button ─────────────────────────────────────────────────

class _ServiceFilterButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final requestsAsync = ref.watch(techRequestsProvider);
    final servicesAsync = ref.watch(servicesProvider);
    final currentSvcId  = requestsAsync.asData?.value.serviceId;

    return IconButton(
      icon: Badge(
        isLabelVisible: currentSvcId != null,
        backgroundColor: AppColors.gold,
        child: Icon(
          Icons.tune_rounded,
          color: currentSvcId != null
              ? AppColors.gold
              : (isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground),
        ),
      ),
      tooltip: 'تصفية حسب الخدمة',
      onPressed: () async {
        final services = servicesAsync.asData?.value ?? [];
        if (services.isEmpty) return;

        final picked = await showModalBottomSheet<int?>(
          context: context,
          isScrollControlled: true,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          builder: (ctx) => _ServicePickerSheet(
            services:   services,
            selectedId: currentSvcId,
          ),
        );
        if (!context.mounted) return;
        if (picked == -1) {
          ref
              .read(techRequestsProvider.notifier)
              .setServiceFilter(null);
        } else if (picked != null) {
          ref
              .read(techRequestsProvider.notifier)
              .setServiceFilter(picked);
        }
      },
    );
  }
}

class _ServicePickerSheet extends StatelessWidget {
  const _ServicePickerSheet({required this.services, this.selectedId});
  final List<dynamic> services;
  final int? selectedId;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          const Text('اختر خدمة',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.clear_all_rounded, color: AppColors.gold),
            title: const Text('عرض الكل'),
            selected: selectedId == null,
            selectedTileColor: AppColors.gold.withValues(alpha: 0.08),
            onTap: () => Navigator.pop(context, -1),
          ),
          ...services.map((svc) => ListTile(
                title: Text(svc.nameAr as String? ?? ''),
                selected: svc.id == selectedId,
                selectedTileColor: AppColors.gold.withValues(alpha: 0.08),
                onTap: () => Navigator.pop(context, svc.id as int),
              )),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// Convenience extension
extension _IterableExt<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
