import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/user_model.dart';

/// Wraps the self-edit endpoints for the authenticated user's own profile.
///
/// Endpoints used:
/// - PATCH /api/users/:id            — update name / email / jobTitle / photo
/// - PATCH /api/users/:id            — change password (currentPassword + newPassword)
/// - PATCH /api/founder/settings     — founder-only: change password or phone
class ProfileService {
  ProfileService(this._dio);

  final Dio _dio;

  // ── Self-edit ─────────────────────────────────────────────────────────────

  /// Updates one or more profile fields. Only non-null values are sent.
  /// [serviceIds] / [areaIds] / [yearsOfExperience] are technician-only
  /// fields (see `PATCH /api/users/:id` in `routes/users.ts`) — passing them
  /// for a customer is harmless since the backend gates their effect on the
  /// caller's role having a technician profile.
  /// Returns the updated [UserModel] (backend responds with `formatUser`).
  Future<UserModel> updateProfile({
    required int userId,
    String? fullName,
    String? email,
    String? jobTitle,
    String? profileImage,
    List<int>? serviceIds,
    List<int>? areaIds,
    int? yearsOfExperience,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (fullName != null) body['fullName'] = fullName;
      if (email != null) body['email'] = email;
      if (jobTitle != null) body['jobTitle'] = jobTitle;
      if (profileImage != null) body['profileImage'] = profileImage;
      if (serviceIds != null) body['serviceIds'] = serviceIds;
      if (areaIds != null) body['areaIds'] = areaIds;
      if (yearsOfExperience != null) body['yearsOfExperience'] = yearsOfExperience;

      final response = await _dio.patch<Map<String, dynamic>>(
        ApiEndpoints.user(userId),
        data: body,
      );
      // Backend responds with formatUser() — the flat user JSON.
      return UserModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// Changes the user's password. Backend validates [currentPassword] first.
  /// Returns the updated [UserModel] on success.
  Future<UserModel> changePassword({
    required int userId,
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        ApiEndpoints.user(userId),
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
      return UserModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  // ── Founder settings ─────────────────────────────────────────────────────

  /// Updates Founder-specific credentials. [currentPassword] is always required.
  /// At least one of [newPassword] / [newPhone] must be provided.
  /// Backend responds with `{ success: true }` on success.
  Future<void> updateFounderSettings({
    required String currentPassword,
    String? newPassword,
    String? newPhone,
  }) async {
    try {
      final body = <String, dynamic>{'currentPassword': currentPassword};
      if (newPassword != null && newPassword.isNotEmpty) {
        body['newPassword'] = newPassword;
      }
      if (newPhone != null && newPhone.isNotEmpty) {
        body['newPhone'] = newPhone;
      }
      await _dio.patch<dynamic>(ApiEndpoints.founderSettings, data: body);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}
