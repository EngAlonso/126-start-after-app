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
import '../providers/requests_list_provider.dart';
import '../widgets/request_list_card.dart';

/// Pushes the "My Requests" screen — the one navigation entry point used
/// by the home tab and the "عرض الكل" / card taps on the home screen's
/// latest-requests preview.
void pushMyRequests(BuildContext context) => context.push(RoutePaths.myRequests);

/// Phase 5 — customer's own service requests: filter tabs covering every
/// backend status, client-side search, pull-to-refresh, and infinite
/// scroll pagination backed by [myRequestsProvider].
class MyRequestsScreen extends ConsumerStatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  ConsumerState<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends ConsumerState<MyRequestsScreen> {
  final _searchCtrl = TextEditingController();
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
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      ref.read(myRequestsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncState = ref.watch(myRequestsProvider);
    final servicesAsync = ref.watch(servicesProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text('طلباتي', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // ── Search ──────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              textDirection: TextDirection.rtl,
              decoration: InputDecoration(
                hintText: 'ابحث في طلباتك (الوصف أو الخدمة)…',
                hintTextDirection: TextDirection.rtl,
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.gold),
                suffixIcon: ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _searchCtrl,
                  builder: (_, v, __) => v.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            _searchCtrl.clear();
                            ref.read(myRequestsProvider.notifier).setSearchQuery('');
                          },
                        )
                      : const SizedBox.shrink(),
                ),
                filled: true,
                fillColor: isDark ? AppColors.darkCard : AppColors.lightCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (v) => ref.read(myRequestsProvider.notifier).setSearchQuery(v),
            ),
          ),

          // ── Filter chips ───────────────────────────────────────────────
          SizedBox(
            height: 42,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: RequestFilter.values.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final filter = RequestFilter.values[i];
                final selected = asyncState.value?.filter == filter;
                return ChoiceChip(
                  label: Text(filter.label),
                  selected: selected,
                  onSelected: (_) => ref.read(myRequestsProvider.notifier).setFilter(filter),
                  selectedColor: AppColors.gold,
                  labelStyle: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : Theme.of(context).colorScheme.onSurface,
                  ),
                  backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
                  side: BorderSide(color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppDesign.radiusLG)),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // ── List / states ──────────────────────────────────────────────
          Expanded(
            child: asyncState.when(
              loading: () => const Padding(
                padding: EdgeInsets.fromLTRB(16, 4, 16, 24),
                child: SkeletonList(count: 5),
              ),
              error: (e, _) => _ErrorState(
                onRetry: () => ref.read(myRequestsProvider.notifier).refresh(),
              ),
              data: (data) {
                final visible = data.visibleItems;
                final serviceNames = servicesAsync.maybeWhen(
                  data: (list) => {for (final s in list) s.id: s.nameAr},
                  orElse: () => <int, String>{},
                );

                if (visible.isEmpty) {
                  final hasQuery = data.searchQuery.isNotEmpty;
                  return RefreshIndicator(
                    color: AppColors.gold,
                    onRefresh: () => ref.read(myRequestsProvider.notifier).refresh(),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.55,
                          child: EmptyStateWidget(
                            icon:     hasQuery
                                ? Icons.search_off_rounded
                                : Icons.receipt_long_outlined,
                            title:    hasQuery
                                ? 'لا توجد نتائج مطابقة'
                                : data.filter == RequestFilter.all
                                    ? 'لا توجد طلبات بعد'
                                    : 'لا توجد طلبات في هذا التصنيف',
                            subtitle: hasQuery
                                ? 'حاول البحث بكلمة مختلفة'
                                : 'اضغط على زر + لإنشاء طلب خدمة جديد',
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  color: AppColors.gold,
                  onRefresh: () => ref.read(myRequestsProvider.notifier).refresh(),
                  child: ListView.separated(
                    controller: _scrollCtrl,
                    physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: visible.length + (data.hasMore ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      if (i >= visible.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.gold),
                            ),
                          ),
                        );
                      }
                      final request = visible[i];
                      return RequestListCard(
                        request: request,
                        serviceName: serviceNames[request.serviceId] ?? 'خدمة',
                        onTap: () => context.push(RoutePaths.requestDetail(request.id)),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
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
