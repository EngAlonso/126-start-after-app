import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

/// Wraps `flutter_secure_storage` (Keychain on iOS, EncryptedSharedPreferences
/// on Android) so tokens are never held in plain SharedPreferences.
///
/// This is the single place allowed to read/write auth tokens on disk —
/// everything else (interceptors, repositories, providers) goes through it.
class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: AppConstants.storageAccessToken, value: accessToken),
      _storage.write(key: AppConstants.storageRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: AppConstants.storageAccessToken);

  Future<String?> getRefreshToken() => _storage.read(key: AppConstants.storageRefreshToken);

  Future<void> saveUserJson(String json) =>
      _storage.write(key: AppConstants.storageUserJson, value: json);

  Future<String?> getUserJson() => _storage.read(key: AppConstants.storageUserJson);

  /// Stable per-install device identifier sent on login/refresh so the
  /// backend's refresh-token table can key sessions per device (matches
  /// the `deviceId` field already accepted by `/auth/login` and
  /// `/auth/refresh` — see the refresh-token rotation/theft-detection
  /// system in the backend).
  Future<String> getOrCreateDeviceId() async {
    final existing = await _storage.read(key: AppConstants.storageDeviceId);
    if (existing != null && existing.isNotEmpty) return existing;
    final generated = _generateDeviceId();
    await _storage.write(key: AppConstants.storageDeviceId, value: generated);
    return generated;
  }

  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: AppConstants.storageAccessToken),
      _storage.delete(key: AppConstants.storageRefreshToken),
      _storage.delete(key: AppConstants.storageUserJson),
    ]);
  }

  /// Whether the session currently on disk was created with "remember me"
  /// checked. Defaults to `true` so behavior for any session written before
  /// this flag existed (or by a future code path that never sets it)
  /// remains "stay logged in" — the safer default for a consumer app.
  Future<void> saveRememberMe(bool value) =>
      _storage.write(key: AppConstants.storageRememberMe, value: value.toString());

  Future<bool> getRememberMe() async {
    final value = await _storage.read(key: AppConstants.storageRememberMe);
    return value != 'false';
  }

  /// Only prefills the login screen's mobile field — never used to decide
  /// auth state, so clearing it is not a security-relevant operation.
  Future<void> saveRememberedMobile(String mobile) =>
      _storage.write(key: AppConstants.storageRememberedMobile, value: mobile);

  Future<String?> getRememberedMobile() =>
      _storage.read(key: AppConstants.storageRememberedMobile);

  Future<void> clearRememberedMobile() =>
      _storage.delete(key: AppConstants.storageRememberedMobile);

  String _generateDeviceId() {
    final now = DateTime.now().microsecondsSinceEpoch;
    final rand = (now * 2654435761) & 0xFFFFFFFF;
    return 'flutter-${now.toRadixString(36)}-${rand.toRadixString(36)}';
  }
}
