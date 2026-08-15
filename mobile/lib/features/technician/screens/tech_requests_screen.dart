import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/service_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../auth/providers/catalog_providers.dart';
import '../providers/tech_providers.dart';
import '../widgets/tech_request_card.dart';

class TechRequestsScreen extends ConsumerStatefulWidget {
  const TechRequestsScreen({super.key});

  @override
  ConsumerState<TechRequestsScreen> createState() => _TechRequestsScreenState();
}

class _TechRequestsScreenState extends ConsumerState<TechRequestsScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 220) {
      ref.read(techRequestsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final requestsAsync = ref.watch(techRequestsProvider);
    final currentFilter =
        requestsAsync.asData?.value.filter ?? TechRequestFilter.all;
    final servicesAsync = ref.watch(servicesProvider);
    final areasAsync = ref.watch(areasProvider);
    final govAsync = ref.watch(governoratesProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      body: NestedScrollView(
        controller: _scrollController,
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          // ── App bar ───────────────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            backgroundColor:
                isDark ? AppColors.darkBackground : AppColors.lightBackground,
            title: const Text('الطلبات المتاحة',
                style: TextStyle(fontWeight: FontWeight.w800)),
            actions: [
              // Service filter button
              _ServiceFilterButton(),
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(50),
              child: _FilterTabBar(
                selected: currentFilter,
                onSelect: (f) =>
                    ref.read(techRequestsProvider.notifier).setFilter(f),
              ),
            ),
          ),
        ],
        body: requestsAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.gold),
          ),
          error: (e, _) => _ErrorBody(
            message: e.toString().replaceFirst('Exception: ', ''),
            onRetry: () =>
                ref.read(techRequestsProvider.notifier).refresh(),
          ),
          data: (state) {
            if (state.items.isEmpty) {
              return RefreshIndicator(
                color: AppColors.gold,
                onRefresh: () =>
                    ref.read(techRequestsProvider.notifier).refresh(),
                child: ListView(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: _EmptyState(filter: state.filter),
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              color: AppColors.gold,
              backgroundColor:
                  isDark ? AppColors.darkCard : AppColors.lightCard,
              strokeWidth: 2.5,
              onRefresh: () =>
                  ref.read(techRequestsProvider.notifier).refresh(),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                itemCount:
                    state.items.length + (state.isLoadingMore ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == state.items.length) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: CircularProgressIndicator(
                            color: AppColors.gold, strokeWidth: 2),
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

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TechRequestCard(
                      request: req,
                      serviceName: svc?.nameAr ?? '...',
                      areaName: area?.nameAr ?? '...',
                      governorateName: gov?.nameAr ?? '...',
                      onTap: () => context.push(
                          RoutePaths.technicianRequestDetail(req.id)),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

// ─── Filter tab bar ───────────────────────────────────────────────────────────

class _FilterTabBar extends StatelessWidget {
  const _FilterTabBar({required this.selected, required this.onSelect});
  final TechRequestFilter selected;
  final ValueChanged<TechRequestFilter> onSelect;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: 50,
      padding: const EdgeInsets.only(bottom: 6),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: TechRequestFilter.values.map((f) {
          final isSelected = f == selected;
          return Padding(
            padding: const EdgeInsets.only(left: 8),
            child: GestureDetector(
              onTap: () => onSelect(f),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.gold
                      : (isDark ? AppColors.darkCard : AppColors.lightCard),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.gold
                        : (isDark
                            ? AppColors.darkBorder
                            : AppColors.lightBorder),
                  ),
                ),
                child: Text(
                  f.label,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: isSelected
                        ? Colors.white
                        : (isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── Service filter button ────────────────────────────────────────────────────

class _ServiceFilterButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(servicesProvider);
    final currentServiceId =
        ref.watch(techRequestsProvider).asData?.value.serviceId;

    return IconButton(
      icon: Badge(
        isLabelVisible: currentServiceId != null,
        backgroundColor: AppColors.gold,
        child: const Icon(Icons.tune_rounded),
      ),
      tooltip: 'تصفية حسب الخدمة',
      onPressed: () async {
        final services = servicesAsync.asData?.value ?? [];
        if (services.isEmpty) return;

        final chosen = await showModalBottomSheet<int?>(
          context: context,
          shape: const RoundedRectangleBorder(
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(20))),
          builder: (ctx) => _ServiceFilterSheet(
              services: services, currentId: currentServiceId),
        );
        // ignore: use_build_context_synchronously
        if (!context.mounted) return;
        if (chosen == -1) {
          ref
              .read(techRequestsProvider.notifier)
              .setServiceFilter(null);
        } else if (chosen != null) {
          ref
              .read(techRequestsProvider.notifier)
              .setServiceFilter(chosen);
        }
      },
    );
  }
}

class _ServiceFilterSheet extends StatelessWidget {
  const _ServiceFilterSheet({required this.services, this.currentId});
  final List<ServiceModel> services;
  final int? currentId;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
                color: isDark ? AppColors.darkInput : AppColors.lightInput,
                borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('تصفية حسب الخدمة',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                if (currentId != null)
                  TextButton(
                    onPressed: () => Navigator.pop(context, -1),
                    child: const Text('إلغاء التصفية',
                        style: TextStyle(color: AppColors.gold)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              padding:
                  const EdgeInsets.fromLTRB(12, 0, 12, 16),
              itemCount: services.length,
              itemBuilder: (context, i) {
                final svc = services[i];
                final isSelected = svc.id == currentId;
                return ListTile(
                  leading: Icon(
                    null,
                    color: isSelected ? AppColors.gold : null,
                  ),
                  title: Text(svc.nameAr,
                      style: TextStyle(
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: isSelected ? AppColors.gold : null)),
                  trailing: isSelected
                      ? const Icon(Icons.check_rounded,
                          color: AppColors.gold)
                      : null,
                  onTap: () => Navigator.pop(context, svc.id),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Empty / Error states ─────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});
  final TechRequestFilter filter;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.inbox_rounded, color: AppColors.gold, size: 52),
        const SizedBox(height: 16),
        Text(
          filter == TechRequestFilter.all
              ? 'لا توجد طلبات متاحة حالياً'
              : 'لا توجد طلبات بهذه الحالة',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'اسحب للأسفل للتحديث',
          style: TextStyle(
            color: isDark
                ? AppColors.darkMutedForeground
                : AppColors.lightMutedForeground,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.gold, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('إعادة المحاولة'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
