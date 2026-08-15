import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/loading_indicator.dart';

/// Shown while [AuthController.build] restores (or fails to find) a
/// session. All redirect logic lives in `app_router.dart` — this screen
/// itself does nothing but render a brand splash + spinner.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cms = ref.watch(cmsBrandingProvider).asData?.value
                ?? CmsSettings.defaults;

    Widget logo;
    if (cms.splashLogoUrl != null) {
      logo = Image.network(
        cms.splashLogoUrl!,
        height: 80,
        fit:    BoxFit.contain,
        errorBuilder: (_, __, ___) => Text(
          cms.appName,
          style: const TextStyle(
            fontSize: 40, fontWeight: FontWeight.bold, color: AppColors.gold,
          ),
        ),
      );
    } else {
      logo = Text(
        cms.appName,
        style: const TextStyle(
          fontSize: 40, fontWeight: FontWeight.bold, color: AppColors.gold,
        ),
      );
    }

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            logo,
            const SizedBox(height: 32),
            const LoadingIndicator(),
          ],
        ),
      ),
    );
  }
}
