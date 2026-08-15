import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/request_model.dart';

/// Wraps the `/api/requests` endpoints — authenticated (customer role).
/// No repository layer needed here: the create-request flow is a one-shot
/// submit with no local state to persist between app launches.
class RequestService {
  RequestService(this._dio);

  final Dio _dio;

  /// `POST /api/requests` — creates a new service request.
  ///
  /// All fields match the backend `createRequestSchema` exactly.
  Future<RequestModel> createRequest({
    required int serviceId,
    required String fullName,
    required String mobile,
    required int governorateId,
    required int areaId,
    required String address,
    required String description,
    List<String> images = const [],
    String? audioUrl,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.requests,
        data: {
          'serviceId': serviceId,
          'fullName': fullName,
          'mobile': mobile,
          'governorateId': governorateId,
          'areaId': areaId,
          'address': address,
          'description': description,
          if (images.isNotEmpty) 'images': images,
          if (audioUrl != null) 'audioUrl': audioUrl,
        },
      );
      return RequestModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/requests` — paginated list for the current user.
  Future<({List<RequestModel> data, int total})> fetchRequests({
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.requests,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (status != null) 'status': status,
        },
      );
      final body = response.data!;
      final items = (body['data'] as List)
          .map((e) => RequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return (data: items, total: body['total'] as int);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/requests/:id`.
  Future<RequestModel> fetchRequest(int id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '${ApiEndpoints.requests}/$id',
      );
      return RequestModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `POST /api/requests/:id/cancel`.
  ///
  /// Also used by the customer to reject a technician's completion claim
  /// (status `waiting_approval`) — the backend has no separate "reject
  /// completion" endpoint; the web client cancels with an explanatory
  /// reason instead, and this mirrors that exactly.
  Future<void> cancelRequest(int id, {required String reason}) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '${ApiEndpoints.requests}/$id/cancel',
        data: {'reason': reason},
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `POST /api/requests/:id/complete` — customer confirms the technician's
  /// completion claim. Only valid while `status == 'waiting_approval'`.
  Future<void> completeRequest(int id) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '${ApiEndpoints.requests}/$id/complete',
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `POST /api/requests/:id/request-completion` — technician signals they
  /// have finished work. Transitions the request to `waiting_approval` so
  /// the customer can confirm or dispute. No request body needed.
  Future<void> requestCompletion(int id) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.requestCompletion(id),
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
