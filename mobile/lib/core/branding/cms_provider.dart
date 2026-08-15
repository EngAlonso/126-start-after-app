import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'cms_repository.dart';
import 'cms_settings.dart';

/// Riverpod provider that fetches CMS branding settings on app start.
///
/// Flutter equivalent of the web's BrandingProvider (branding-context.tsx).
/// Any widget can read branding values via:
///
///   final cms = ref.watch(cmsBrandingProvider).asData?.value
///               ?? CmsSettings.defaults;
///
/// The provider loads from the network (with SharedPreferences cache fallback)
/// and resolves to CmsSettings. On network failure it resolves to cached or
/// default values — it never throws to the UI.
final cmsBrandingProvider =
    AsyncNotifierProvider<CmsBrandingNotifier, CmsSettings>(
  CmsBrandingNotifier.new,
);

class CmsBrandingNotifier extends AsyncNotifier<CmsSettings> {
  @override
  Future<CmsSettings> build() async {
    final repo = ref.read(cmsRepositoryProvider);
    return repo.getCmsSettings();
  }
}
