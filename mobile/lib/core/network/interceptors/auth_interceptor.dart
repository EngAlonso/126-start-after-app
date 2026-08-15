import 'package:dio/dio.dart';

import '../../storage/secure_storage_service.dart';

/// Attaches the access token to every request and transparently refreshes
/// it on a 401, mirroring the web client's `custom-fetch.ts` retry hook so
/// both clients speak to the same refresh-token contract.
///
/// Single-flight: if multiple requests 401 at the same time (e.g. a screen
/// firing several parallel calls), only the first triggers a refresh; the
/// rest await that same in-flight future instead of racing the backend's
/// refresh-token rotation (which revokes the whole session on token reuse —
/// see the backend's theft-detection logic).
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required SecureStorageService storage,
    required Dio refreshDio,
    required String refreshPath,
    required void Function() onSessionExpired,
  })  : _storage = storage,
        _refreshDio = refreshDio,
        _refreshPath = refreshPath,
        _onSessionExpired = onSessionExpired;

  final SecureStorageService _storage;
  final Dio _refreshDio;
  final String _refreshPath;
  final void Function() _onSessionExpired;

  Future<String?>? _refreshInFlight;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra['skipAuth'] != true) {
      final token = await _storage.getAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final request = err.requestOptions;

    final isAuthEndpoint = request.path.contains('/auth/login') ||
        request.path.contains('/auth/refresh');

    if (response?.statusCode != 401 || isAuthEndpoint || request.extra['retriedAfterRefresh'] == true) {
      handler.next(err);
      return;
    }

    final newAccessToken = await _refreshAccessToken();
    if (newAccessToken == null) {
      _onSessionExpired();
      handler.next(err);
      return;
    }

    try {
      request.extra['retriedAfterRefresh'] = true;
      request.headers['Authorization'] = 'Bearer $newAccessToken';
      final retryResponse = await _refreshDio.fetch(request);
      handler.resolve(retryResponse);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<String?> _refreshAccessToken() {
    // Coalesce concurrent refresh attempts into a single request.
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<String?> _performRefresh() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) return null;
    final deviceId = await _storage.getOrCreateDeviceId();

    try {
      final response = await _refreshDio.post<Map<String, dynamic>>(
        _refreshPath,
        data: {'refreshToken': refreshToken, 'deviceId': deviceId},
        options: Options(extra: {'skipAuth': true}),
      );
      final data = response.data;
      if (data == null) return null;

      final newAccessToken = (data['accessToken'] ?? data['token']) as String?;
      final newRefreshToken = data['refreshToken'] as String?;
      if (newAccessToken == null || newRefreshToken == null) return null;

      await _storage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );
      return newAccessToken;
    } on DioException {
      // Refresh token was invalid/expired/reused — backend has already
      // revoked the session server-side (reuse-detection). Clear locally.
      await _storage.clearSession();
      return null;
    }
  }
}
