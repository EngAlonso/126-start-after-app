import 'dart:convert';

import '../core/storage/secure_storage_service.dart';
import '../models/auth_session_model.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

/// Owns the auth session lifecycle: login persists tokens, auto-login
/// restores them, logout clears them. This is the only layer
/// [AuthController] (Riverpod) talks to — it never touches Dio or secure
/// storage directly.
class AuthRepository {
  AuthRepository({
    required AuthService authService,
    required SecureStorageService storage,
  })  : _authService = authService,
        _storage = storage;

  final AuthService _authService;
  final SecureStorageService _storage;

  Future<UserModel> login({
    required String mobile,
    required String password,
    bool rememberMe = true,
  }) async {
    final deviceId = await _storage.getOrCreateDeviceId();
    final session = await _authService.login(
      mobile: mobile,
      password: password,
      deviceId: deviceId,
    );
    await _persistSession(session, mobile: mobile, rememberMe: rememberMe);
    return session.user;
  }

  Future<UserModel> registerCustomer({
    required String fullName,
    required String mobile,
    required String password,
    String? referredBy,
    bool rememberMe = true,
  }) async {
    final deviceId = await _storage.getOrCreateDeviceId();
    final session = await _authService.registerCustomer(
      fullName: fullName,
      mobile: mobile,
      password: password,
      deviceId: deviceId,
      referredBy: referredBy,
    );
    await _persistSession(session, mobile: mobile, rememberMe: rememberMe);
    return session.user;
  }

  /// Does not touch stored session data — see [AuthService.registerTechnician]
  /// for why (the backend never issues tokens for a pending technician).
  Future<UserModel> registerTechnician({
    required String fullName,
    required String mobile,
    required String password,
    required String nationalId,
    String? personalPhoto,
    required String nationalIdFront,
    required String nationalIdBack,
    required List<int> serviceIds,
    required List<int> areaIds,
    required int primaryAreaId,
    required int yearsOfExperience,
  }) {
    return _authService.registerTechnician(
      fullName: fullName,
      mobile: mobile,
      password: password,
      nationalId: nationalId,
      personalPhoto: personalPhoto,
      nationalIdFront: nationalIdFront,
      nationalIdBack: nationalIdBack,
      serviceIds: serviceIds,
      areaIds: areaIds,
      primaryAreaId: primaryAreaId,
      yearsOfExperience: yearsOfExperience,
    );
  }

  Future<void> _persistSession(
    AuthSessionModel session, {
    required String mobile,
    required bool rememberMe,
  }) async {
    await _storage.saveTokens(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
    await _storage.saveUserJson(jsonEncode(session.user.toJson()));
    await _storage.saveRememberMe(rememberMe);
    if (rememberMe) {
      await _storage.saveRememberedMobile(mobile);
    } else {
      await _storage.clearRememberedMobile();
    }
  }

  Future<String?> getRememberedMobile() => _storage.getRememberedMobile();

  /// Called from the app-lifecycle observer when the app is being torn
  /// down. If the active session was created with "remember me" unchecked,
  /// the session is wiped so the next cold start requires a fresh login
  /// instead of auto-restoring — the access/refresh tokens still had to be
  /// persisted to secure storage while the app was running (the
  /// [AuthInterceptor] reads them on every request), so this is the only
  /// point at which "don't remember me" can actually take effect.
  Future<void> clearSessionIfNotRemembered() async {
    final rememberMe = await _storage.getRememberMe();
    if (!rememberMe) {
      await _storage.clearSession();
    }
  }

  /// Called on app start. Returns the cached user immediately (for a fast
  /// splash → home transition) without waiting on the network, then lets
  /// the caller decide whether to refresh it from `/auth/me` in the
  /// background. Returns null if there's no stored session at all.
  Future<UserModel?> restoreSession() async {
    final accessToken = await _storage.getAccessToken();
    final refreshToken = await _storage.getRefreshToken();
    if (accessToken == null || refreshToken == null) return null;

    final cachedJson = await _storage.getUserJson();
    if (cachedJson == null) {
      // We have tokens but no cached user (shouldn't normally happen) —
      // fall back to a network fetch; the AuthInterceptor will refresh the
      // access token transparently if it's already expired.
      return _authService.fetchMe();
    }
    return UserModel.fromJson(jsonDecode(cachedJson) as Map<String, dynamic>);
  }

  Future<UserModel> refreshCachedUser() async {
    final user = await _authService.fetchMe();
    await _storage.saveUserJson(jsonEncode(user.toJson()));
    return user;
  }

  Future<void> logout() async {
    final refreshToken = await _storage.getRefreshToken();
    await _authService.logout(refreshToken: refreshToken);
    await _storage.clearSession();
  }

  Future<void> logoutAllDevices() async {
    await _authService.logoutAll();
    await _storage.clearSession();
  }
}
