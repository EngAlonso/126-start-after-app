import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../auth/providers/auth_providers.dart';

/// Fetches the platform-wide loyalty configuration from GET /api/loyalty/config.
///
/// This is a public endpoint (no auth required on the backend).
/// Key values for the mobile app:
///   • [referralReferrerCoins] — coins the referrer earns per completed referral
///   • [referralRefereeCoins]  — coins the new customer earns on first completion
///   • [coinName]              — localised coin name (Arabic)
///   • [referralEnabled]       — whether the referral system is active
final loyaltyConfigProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final dio = ref.watch(dioClientProvider).dio;
  final response =
      await dio.get<Map<String, dynamic>>(ApiEndpoints.loyaltyConfig);
  return response.data ?? {};
});
