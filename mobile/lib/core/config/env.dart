/// Centralized environment configuration.
///
/// The Flutter app never modifies or assumes the backend's routing — it
/// only needs to know the base URL where `/api/*` is served. The API
/// server sits behind Replit's shared reverse proxy at the artifact's
/// `/api` path (see `artifacts/api-server`), so the mobile app's base URL
/// is always `<host>/api`.
///
/// Pass the host at build/run time, e.g.:
///
/// ```
/// flutter run --dart-define=API_HOST=https://your-repl-domain.replit.dev
/// flutter build apk --dart-define=API_HOST=https://fnashha.com
/// ```
///
/// [apiHost] intentionally has no production fallback baked in — forgetting
/// to pass it should fail loudly (obviously-wrong localhost calls) rather
/// than silently pointing a shipped app at a dev server.
class Env {
  Env._();

  static const String apiHost = String.fromEnvironment(
    'API_HOST',
    // Default points to the Replit dev proxy so the app works on real Android
    // and iOS devices without needing --dart-define at every flutter run.
    // Override for production: --dart-define=API_HOST=https://fnashha.com
    defaultValue: 'https://a69386f1-6721-4497-a96a-cb53444f3cfb-00-129kyn5esyz4d.riker.replit.dev',
  );

  /// All backend routes are mounted under `/api` behind the shared proxy.
  static String get apiBaseUrl => '$apiHost/api';

  /// Local-disk uploads (`POST /api/upload/user`) return a root-relative
  /// path like `/uploads/requests/xxx.jpg` — mounted as a static route on
  /// the same Express app as `/api`, i.e. under [apiHost], not [apiBaseUrl].
  /// Absolute URLs (e.g. Cloudinary CMS assets) pass through unchanged.
  static String mediaUrl(String path) => path.startsWith('http') ? path : '$apiHost$path';

  static const bool isProduction = bool.fromEnvironment('dart.vm.product');
}
