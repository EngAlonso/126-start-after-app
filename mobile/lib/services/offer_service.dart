import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/offer_model.dart';

/// Wraps the `/api/requests/:id/offers` + technician public-profile
/// endpoints needed by the customer-facing Offers module (Phase 6).
class OfferService {
  OfferService(this._dio);

  final Dio _dio;

  /// `GET /api/requests/:requestId/offers` — every offer on a request,
  /// oldest first, each enriched with technician rating/review count.
  Future<List<OfferModel>> fetchOffers(int requestId) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.requestOffers(requestId),
      );
      return (response.data ?? [])
          .map((e) => OfferModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `POST /api/requests/:requestId/offers/:offerId/select` — customer
  /// accepts this offer; the backend rejects every other pending offer on
  /// the same request and moves the request to `technician_selected`.
  Future<void> selectOffer(int requestId, int offerId) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.selectOffer(requestId, offerId),
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/technicians/:userId/public-profile` — used only to enrich
  /// the Offer Details screen with `completedJobs`, which the offers list
  /// endpoint does not include.
  Future<TechnicianPublicProfile> fetchTechnicianPublicProfile(int userId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.technicianPublicProfile(userId),
      );
      return TechnicianPublicProfile.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
