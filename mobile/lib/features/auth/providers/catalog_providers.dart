import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/area_model.dart';
import '../../../models/governorate_model.dart';
import '../../../models/service_model.dart';
import '../../../services/catalog_service.dart';
import '../../../services/upload_service.dart';
import 'auth_providers.dart';

/// Reference data backing the technician registration wizard's
/// service/area pickers. Plain [FutureProvider]s (no repository layer) —
/// see `CatalogService` for why: there's no local state to coordinate,
/// only a network read.
final catalogServiceProvider = Provider<CatalogService>((ref) {
  return CatalogService(ref.watch(dioClientProvider).dio);
});

final uploadServiceProvider = Provider<UploadService>((ref) {
  return UploadService(ref.watch(dioClientProvider).dio);
});

final servicesProvider = FutureProvider<List<ServiceModel>>((ref) {
  return ref.watch(catalogServiceProvider).fetchServices();
});

final governoratesProvider = FutureProvider<List<GovernorateModel>>((ref) {
  return ref.watch(catalogServiceProvider).fetchGovernorates();
});

final areasProvider = FutureProvider<List<AreaModel>>((ref) {
  return ref.watch(catalogServiceProvider).fetchAreas();
});
