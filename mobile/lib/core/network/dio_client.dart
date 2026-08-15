import 'package:dio/dio.dart';

import '../config/env.dart';
import '../constants/app_constants.dart';
import '../storage/secure_storage_service.dart';
import 'api_exception.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/logging_interceptor.dart';

/// Builds the two Dio instances the app needs:
/// - [DioClient.dio] — the main client used for all authenticated calls.
/// - [DioClient.refreshDio] — a bare client with no auth interceptor, used
///   only to call `/auth/refresh` and to retry a request after a refresh
///   without recursively triggering the same interceptor.
class DioClient {
  DioClient({
    required SecureStorageService storage,
    void Function()? onSessionExpired,
  }) : _storage = storage {
    refreshDio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
        contentType: 'application/json',
      ),
    )..interceptors.add(LoggingInterceptor());

    dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
        contentType: 'application/json',
      ),
    )
      ..interceptors.add(
        AuthInterceptor(
          storage: _storage,
          refreshDio: refreshDio,
          refreshPath: '/auth/refresh',
          onSessionExpired: onSessionExpired ?? () {},
        ),
      )
      ..interceptors.add(LoggingInterceptor());
  }

  final SecureStorageService _storage;

  late final Dio dio;
  late final Dio refreshDio;

  /// Normalizes any Dio failure into an [ApiException] with the backend's
  /// Arabic error message (routes return `{ error: "..." }`) when present.
  static ApiException toApiException(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      final serverMessage = (data is Map && data['error'] is String) ? data['error'] as String : null;
      final isNetworkError = error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout;
      return ApiException(
        message: serverMessage ?? (isNetworkError ? 'تحقق من اتصال الإنترنت' : 'حدث خطأ في الخادم'),
        statusCode: error.response?.statusCode,
        isNetworkError: isNetworkError,
      );
    }
    return ApiException(message: error.toString());
  }
}
