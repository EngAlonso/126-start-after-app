import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../providers/services_providers.dart';
import '../widgets/service_card.dart';

/// Full-screen services catalogue — search bar + responsive grid.
/// Uses [filteredServicesProvider] (backed by [servicesProvider] from
/// `catalog_providers.dart`) so the network request is shared with every
/// other consumer and is never duplicated.
class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filteredAsync = ref.watch(filteredServicesProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'الخدمات',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'تحديث',
            onPressed: () => ref.invalidate(filteredServicesProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search bar ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: TextField(
              controller: _searchCtrl,
              textDirection: TextDirection.rtl,
              decoration: InputDecoration(
                hintText: 'ابحث عن خدمة…',
                hintTextDirection: TextDirection.rtl,
                prefixIcon:
                    const Icon(Icons.search_rounded, color: AppColors.gold),
                suffixIcon: ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _searchCtrl,
                  builder: (_, v, __) => v.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            _searchCtrl.clear();
                            ref
                                .read(serviceSearchQueryProvider.notifier)
                                .clear();
                          },
                        )
                      : const SizedBox.shrink(),
                ),
                filled: true,
                fillColor: isDark
                    ? AppColors.darkCard
                    : AppColors.lightCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (v) =>
                  ref.read(serviceSearchQueryProvider.notifier).update(v),
            ),
          ),

          // ── Grid / states ──────────────────────────────────────────────
          Expanded(
            child: filteredAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.gold),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off_rounded,
                        size: 48, color: AppColors.gold),
                    const SizedBox(height: 12),
                    const Text('تعذر تحميل الخدمات',
                        style: TextStyle(fontSize: 16)),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () =>
                          ref.invalidate(filteredServicesProvider),
                      child: const Text('إعادة المحاولة'),
                    ),
                  ],
                ),
              ),
              data: (services) {
                if (services.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.search_off_rounded,
                            size: 48,
                            color: Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant),
                        const SizedBox(height: 12),
                        Text(
                          'لا توجد نتائج',
                          style: TextStyle(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant),
                        ),
                      ],
                    ),
                  );
                }

                return LayoutBuilder(
                  builder: (context, constraints) {
                    // 3 cols on tablet (≥500 dp), 2 on phone
                    final cols = constraints.maxWidth >= 500 ? 3 : 2;
                    return GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      gridDelegate:
                          SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: cols,
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                        childAspectRatio: 1.05,
                      ),
                      itemCount: services.length,
                      itemBuilder: (context, i) {
                        final svc = services[i];
                        return ServiceCard(
                          service: svc,
                          // Tapping a service from the catalogue goes straight
                          // to the create-request form with the service pre-selected.
                          onTap: () => context.push(
                            '${RoutePaths.createRequest}?serviceId=${svc.id}',
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
