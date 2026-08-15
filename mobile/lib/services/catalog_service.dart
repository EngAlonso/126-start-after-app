import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/area_model.dart';
import '../models/governorate_model.dart';
import '../models/service_model.dart';

/// Read-only reference data used by the technician registration wizard
/// (service list, governorates, areas). These endpoints are public (no
/// auth required) on the backend, mirrored here 1:1 — no repository layer
/// is needed since there is no local state/storage to coordinate, unlike
/// [AuthService] which [AuthRepository] wraps for token persistence.
class CatalogService {
  CatalogService(this._dio);

  final Dio _dio;

  Future<List<ServiceModel>> fetchServices({bool activeOnly = true}) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.services,
        queryParameters: activeOnly ? {'active': 'true'} : null,
        options: Options(extra: {'skipAuth': true}),
      );
      return (response.data ?? [])
          .map((e) => ServiceModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  Future<List<GovernorateModel>> fetchGovernorates() async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.governorates,
        options: Options(extra: {'skipAuth': true}),
      );
      return (response.data ?? [])
          .map((e) => GovernorateModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  Future<List<AreaModel>> fetchAreas({bool activeOnly = true}) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.areas,
        queryParameters: activeOnly ? {'active': 'true'} : null,
        options: Options(extra: {'skipAuth': true}),
      );
      return (response.data ?? [])
          .map((e) => AreaModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
