import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/branding/cms_provider.dart';
import 'core/branding/cms_settings.dart';
import 'features/auth/providers/auth_providers.dart';
import 'routing/app_router.dart';
import 'theme/app_theme.dart';
import 'theme/theme_mode_provider.dart';

/// Root widget. The app is Arabic-first (all backend copy and the existing
/// web app are Arabic-only), so the locale is pinned to `ar` and text
/// direction to RTL rather than following the device locale — an
/// English/LTR variant would need its own product decision, not just an
/// `intl` fallback.
class FnashhaApp extends ConsumerStatefulWidget {
  const FnashhaApp({super.key});

  @override
  ConsumerState<FnashhaApp> createState() => _FnashhaAppState();
}

/// Implements the "don't remember me" half of the remember-me feature:
/// tokens must stay in secure storage for the [AuthInterceptor] to attach
/// them while the app is running, so the only point at which "don't
/// remember me" can take effect is app teardown — see
/// `AuthRepository.clearSessionIfNotRemembered`. `detached` is the closest
/// signal Flutter's lifecycle API offers to "app closed" without a native
/// platform channel, and is reliable on Android; iOS may not always fire it
/// on a hard swipe-kill, which is an accepted limitation of this approach.
class _FnashhaAppState extends ConsumerState<FnashhaApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.detached) {
      ref.read(authRepositoryProvider).clearSessionIfNotRemembered();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final cms    = ref.watch(cmsBrandingProvider).asData?.value
                   ?? CmsSettings.defaults;

    return MaterialApp.router(
      title: cms.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ref.watch(themeModeProvider).asData?.value ?? ThemeMode.system,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      routerConfig: router,
    );
  }
}
