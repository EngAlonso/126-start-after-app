import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/auth_session_model.dart';
import '../models/user_model.dart';

/// Thin wrapper directly over the auth HTTP calls — no state, no storage.
/// [AuthRepository] is the layer that persists tokens and exposes app
/// state; this class only knows how to talk to the existing endpoints.
class AuthService {
  AuthService(this._dio);

  final Dio _dio;

  Future<AuthSessionModel> login({
    required String mobile,
    required String password,
    required String deviceId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.login,
        data: {'mobile': mobile, 'password': password, 'deviceId': deviceId},
        options: Options(extra: {'skipAuth': true}),
      );
      final data = response.data!;
      return AuthSessionModel(
        accessToken: (data['accessToken'] ?? data['token']) as String,
        refreshToken: data['refreshToken'] as String,
        user: UserModel.fromJson(data['user'] as Map<String, dynamic>),
        permissions: (data['permissions'] as List?)?.cast<String>() ?? const [],
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  Future<UserModel> fetchMe() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(ApiEndpoints.me);
      // GET /auth/me returns the user fields spread at the top level
      // (`{ ...formatUser(user), permissions }`), unlike /auth/login and
      // /auth/register/* which nest it under a `user` key — see
      // artifacts/api-server/src/routes/auth.ts.
      return UserModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  Future<AuthSessionModel> registerCustomer({
    required String fullName,
    required String mobile,
    required String password,
    required String deviceId,
    String? referredBy,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.registerCustomer,
        data: {
          'fullName': fullName,
          'mobile': mobile,
          'password': password,
          'deviceId': deviceId,
          if (referredBy != null && referredBy.trim().isNotEmpty) 'referredBy': referredBy.trim(),
        },
        options: Options(extra: {'skipAuth': true}),
      );
      final data = response.data!;
      return AuthSessionModel(
        accessToken: (data['accessToken'] ?? data['token']) as String,
        refreshToken: data['refreshToken'] as String,
        user: UserModel.fromJson(data['user'] as Map<String, dynamic>),
        permissions: (data['permissions'] as List?)?.cast<String>() ?? const [],
      );
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// Technician registration never logs the caller in — the backend leaves
  /// new technician accounts in `status: "pending"` until an admin
  /// approves them, and issues no tokens (`{ pending: true, user }`). The
  /// returned [UserModel] is only used to show a confirmation screen.
  Future<UserModel> registerTechnician({
    required String fullName,
    required String mobile,
    required String password,
    required String nationalId,
    String? personalPhoto,
    required String nationalIdFront,
    required String nationalIdBack,
    required List<int> serviceIds,
    required List<int> areaIds,
    required int primaryAreaId,
    required int yearsOfExperience,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.registerTechnician,
        data: {
          'fullName': fullName,
          'mobile': mobile,
          'password': password,
          'nationalId': nationalId,
          if (personalPhoto != null) 'personalPhoto': personalPhoto,
          'nationalIdFront': nationalIdFront,
          'nationalIdBack': nationalIdBack,
          'serviceIds': serviceIds,
          'areaIds': areaIds,
          'primaryAreaId': primaryAreaId,
          'yearsOfExperience': yearsOfExperience,
        },
        options: Options(extra: {'skipAuth': true}),
      );
      return UserModel.fromJson(response.data!['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  Future<void> logout({String? refreshToken}) async {
    try {
      await _dio.post<void>(
        ApiEndpoints.logout,
        data: refreshToken != null ? {'refreshToken': refreshToken} : null,
      );
    } on DioException {
      // Logout is best-effort server-side (token revocation); local session
      // clearing in the repository must proceed regardless.
    }
  }

  Future<void> logoutAll() async {
    try {
      await _dio.post<void>(ApiEndpoints.logoutAll);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
