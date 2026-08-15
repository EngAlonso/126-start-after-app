import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/offer_model.dart';
import '../models/request_model.dart';
import '../models/tech_point_transaction_model.dart';
import '../models/tech_points_model.dart';
import '../models/technician_full_profile_model.dart';

/// Technician-facing API calls: available requests, points balance,
/// offer submission and editing.
///
/// The `GET /api/requests` endpoint is shared with the customer side but
/// the backend auto-filters for the technician's registered services/areas
/// when the caller's role is `technician`, so no extra query params are
/// needed for scoping — filters are purely user-initiated.
class TechnicianService {
  TechnicianService(this._dio);

  final Dio _dio;

  // ── Available requests ────────────────────────────────────────────────

  /// `GET /api/requests` — the backend restricts results to requests that
  /// are discoverable for this technician (pending/offers_received matching
  /// their services+areas) plus any request where they are the
  /// `selectedTechnicianId`.
  Future<({List<RequestModel> data, int total})> fetchAvailableRequests({
    int page = 1,
    int limit = 20,
    String? status,
    int? serviceId,
    int? governorateId,
    int? areaId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.requests,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (status != null) 'status': status,
          if (serviceId != null) 'serviceId': serviceId,
          if (governorateId != null) 'governorateId': governorateId,
          if (areaId != null) 'areaId': areaId,
        },
      );
      final body = response.data!;
      final items = (body['data'] as List)
          .map((e) => RequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return (data: items, total: body['total'] as int? ?? items.length);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── Points balance ────────────────────────────────────────────────────

  /// `GET /api/points/balance` — returns `{ balance, reserved, available }`.
  Future<TechPointsModel> fetchPointsBalance() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiEndpoints.pointsBalance);
      return TechPointsModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/points/transactions?page=` — the technician's own point
  /// ledger, newest first. The backend returns a bare array with a fixed
  /// page size of 50 and no total-count metadata, so callers must infer
  /// `hasMore` from whether a full page was returned.
  Future<List<TechPointTransactionModel>> fetchPointTransactions({
    int page = 1,
  }) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.pointsTransactions,
        queryParameters: {'page': page},
      );
      return (response.data ?? [])
          .map((e) =>
              TechPointTransactionModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── Full profile (own catalog data) ───────────────────────────────────

  /// `GET /api/technicians/:userId/profile` — public route returning the
  /// technician's services, coverage areas, years of experience, approval
  /// status, and rating stats. Used to display (and pre-fill editing of)
  /// the technician's own profile.
  Future<TechnicianFullProfileModel> fetchFullProfile(int userId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.technicianFullProfile(userId),
        options: Options(extra: {'skipAuth': true}),
      );
      return TechnicianFullProfileModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── Offer submission ──────────────────────────────────────────────────

  /// `POST /api/requests/:requestId/offers`
  ///
  /// [price]      — technician's labour cost (required, > 0).
  /// [spareParts] — optional spare-parts cost (defaults to 0 on the backend).
  /// [notes]      — optional free-text note to the customer.
  Future<OfferModel> submitOffer({
    required int requestId,
    required double price,
    double spareParts = 0,
    String? notes,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.submitOffer(requestId),
        data: {
          'price': price,
          if (spareParts > 0) 'spareParts': spareParts,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
      return OfferModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── My completed jobs ─────────────────────────────────────────────────

  /// `GET /api/requests/my-completed` — paginated list of requests where
  /// this technician was the assigned technician and `status == 'completed'`.
  /// The response includes nested `customer` and `service` objects.
  Future<({List<RequestModel> data, int total})> fetchMyCompletedRequests({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.myCompletedRequests,
        queryParameters: {'page': page, 'limit': limit},
      );
      final body = response.data!;
      final items = (body['data'] as List)
          .map((e) => RequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return (data: items, total: body['total'] as int? ?? items.length);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── Price adjustment ──────────────────────────────────────────────────

  /// `POST /api/requests/:id/price-adjustment` — technician proposes a
  /// revised price while the request is `in_progress`. Transitions the
  /// request to `price_change_requested` until the customer responds.
  ///
  /// [newPrice]      — revised labour cost (required).
  /// [newSpareParts] — revised spare-parts cost (optional, defaults 0).
  /// [newDescription]— optional note explaining the change.
  Future<void> proposePriceAdjustment(
    int requestId, {
    required double newPrice,
    double newSpareParts = 0,
    String? newDescription,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.priceAdjustment(requestId),
        data: {
          'newPrice': newPrice,
          if (newSpareParts > 0) 'newSpareParts': newSpareParts,
          if (newDescription != null && newDescription.isNotEmpty)
            'newDescription': newDescription,
        },
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── Offer editing ─────────────────────────────────────────────────────

  /// `PATCH /api/requests/:requestId/offers/:offerId`
  ///
  /// Allowed only while the offer status is `pending` or `offers_received`.
  /// Pass only the fields the technician changed — nulls are omitted.
  Future<OfferModel> updateOffer({
    required int requestId,
    required int offerId,
    double? price,
    double? spareParts,
    String? notes,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (price != null) body['price'] = price;
      if (spareParts != null) body['spareParts'] = spareParts;
      if (notes != null) body['notes'] = notes;

      final response = await _dio.patch<Map<String, dynamic>>(
        ApiEndpoints.updateOffer(requestId, offerId),
        data: body,
      );
      return OfferModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
