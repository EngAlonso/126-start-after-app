class AppConstants {
  AppConstants._();

  static const String appName = 'فنشها';

  /// Keys used in secure storage. Keep in one place so token handling code
  /// and any future "log out of all devices" logic can't drift.
  static const String storageAccessToken = 'fnashha_access_token';
  static const String storageRefreshToken = 'fnashha_refresh_token';
  static const String storageDeviceId = 'fnashha_device_id';
  static const String storageUserJson = 'fnashha_user_cache';

  /// "Remember me" support: `storageRememberMe` records whether the last
  /// login opted into a persisted session (see [SecureStorageService] and
  /// `AuthLifecycleObserver`); `storageRememberedMobile` only prefills the
  /// mobile field on the login screen and carries no security weight.
  static const String storageRememberMe = 'fnashha_remember_me';
  static const String storageRememberedMobile = 'fnashha_remembered_mobile';

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);

  /// SSE ping interval sent by the backend (`:ping\n\n` every 25s). Used as
  /// a watchdog: if nothing arrives for 2x this long, treat the connection
  /// as dead and reconnect instead of waiting on the OS socket timeout.
  static const Duration sseWatchdogTimeout = Duration(seconds: 50);
}
