import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/coin_transaction_model.dart';
import '../models/referral_model.dart';
import '../models/wallet_model.dart';

/// Wraps the `/api/loyalty/*` endpoints that belong to the Wallet module.
/// Does NOT include admin endpoints — those are web-only.
class WalletService {
  WalletService(this._dio);

  final Dio _dio;

  /// `GET /api/loyalty/wallet`
  /// Returns the authenticated customer's wallet balances and coin config.
  Future<WalletModel> fetchWallet() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiEndpoints.loyaltyWallet);
      return WalletModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/loyalty/transactions`
  /// Paginated transaction history, newest first.
  Future<({List<CoinTransactionModel> data, int total, int totalPages})>
      fetchTransactions({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.loyaltyTransactions,
        queryParameters: {'page': page, 'limit': limit},
      );
      final body = response.data!;
      final items = (body['transactions'] as List<dynamic>? ?? [])
          .map((e) =>
              CoinTransactionModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return (
        data: items,
        total: (body['total'] as num?)?.toInt() ?? 0,
        totalPages: (body['totalPages'] as num?)?.toInt() ?? 1,
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/loyalty/referral-code`
  /// Returns the user's referral code, shareable link, stats, and history.
  Future<ReferralModel> fetchReferral() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiEndpoints.loyaltyReferral);
      return ReferralModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
