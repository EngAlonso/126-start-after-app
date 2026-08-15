import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/providers/auth_providers.dart';

/// Service for submitting and fetching technician service-modification requests.
///
/// Technicians cannot directly change their registered services or coverage
/// areas. Instead they submit a [ModificationRequest] which an admin reviews.
class TechModificationService {
  TechModificationService(this._dio);
  final Dio _dio;

  /// POST /api/technicians/modification-requests
  Future<Map<String, dynamic>> submitRequest({
    required String requestType,
    required String details,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.techModificationRequests,
        data: {
          'requestType': requestType,
          'details': details,
        },
      );
      return response.data!;
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// GET /api/technicians/modification-requests
  /// Returns the authenticated technician's own requests.
  Future<List<Map<String, dynamic>>> fetchMyRequests() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.techModificationRequests,
      );
      final data = response.data!['data'] as List<dynamic>? ?? [];
      return data.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}

final techModificationServiceProvider =
    Provider<TechModificationService>((ref) {
  return TechModificationService(ref.watch(dioClientProvider).dio);
});
