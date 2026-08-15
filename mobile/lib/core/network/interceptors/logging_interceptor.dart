import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Debug-only request/response logging. Compiled out of release builds via
/// `kDebugMode` so no request/response bodies (which can include tokens)
/// ever reach a release log.
class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (kDebugMode) {
      debugPrint('➡️  ${options.method} ${options.uri}');
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (kDebugMode) {
      debugPrint('✅ ${response.requestOptions.method} ${response.requestOptions.uri} '
          '(${response.statusCode})');
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (kDebugMode) {
      debugPrint('❌ ${err.requestOptions.method} ${err.requestOptions.uri} '
          '(${err.response?.statusCode}) ${err.message}');
    }
    handler.next(err);
  }
}
