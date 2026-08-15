import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/service_model.dart';
import '../../auth/providers/catalog_providers.dart';

// ─── Search query (Riverpod 3 — no StateProvider in v3) ──────────────────────

/// Simple string-state notifier for the services search field.
/// The screen writes `ref.read(serviceSearchQueryProvider.notifier).state = v`
/// and any widget watching [filteredServicesProvider] rebuilds automatically.
class ServiceSearchNotifier extends Notifier<String> {
  @override
  String build() => '';

  // ignore: use_setters_to_change_properties
  void update(String query) => state = query;

  void clear() => state = '';
}

final serviceSearchQueryProvider =
    NotifierProvider<ServiceSearchNotifier, String>(
  ServiceSearchNotifier.new,
);

// ─── Filtered services ────────────────────────────────────────────────────────

/// Derived list: all active services filtered by the current search query.
/// Reads [servicesProvider] (from `catalog_providers.dart`) and filters
/// locally, avoiding an extra network call every time the user types.
final filteredServicesProvider = Provider<AsyncValue<List<ServiceModel>>>((ref) {
  final query = ref.watch(serviceSearchQueryProvider).trim().toLowerCase();
  return ref.watch(servicesProvider).whenData((all) {
    if (query.isEmpty) return all;
    return all
        .where((s) =>
            s.nameAr.toLowerCase().contains(query) ||
            s.name.toLowerCase().contains(query))
        .toList();
  });
});

// ─── Single service lookup ────────────────────────────────────────────────────

/// Look up a single [ServiceModel] by id from the already-cached list.
/// Returns null while loading or if the id is not found.
final serviceByIdProvider = Provider.family<ServiceModel?, int>((ref, id) {
  return ref
      .watch(servicesProvider)
      .asData
      ?.value
      .where((s) => s.id == id)
      .firstOrNull;
});
