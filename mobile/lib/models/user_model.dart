import 'package:freezed_annotation/freezed_annotation.dart';

import 'technician_profile_model.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

/// Mirrors the object returned by the backend's `formatUser()` helper
/// (see `artifacts/api-server/src/routes/auth.ts`), used by
/// `/auth/login`, `/auth/me`, and registration responses alike.
@freezed
abstract class UserModel with _$UserModel {
  const factory UserModel({
    required int id,
    required String fullName,
    required String mobile,
    String? email,
    required String role, // customer | technician | admin | super_admin
    required String status,
    String? profileImage,
    String? jobTitle,
    String? createdAt,
    String? suspensionReason,
    String? bannedUntil,
    @Default(false) bool isFounder,
    TechnicianProfileModel? technicianProfile,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) => _$UserModelFromJson(json);
}

extension UserModelRole on UserModel {
  bool get isCustomer => role == 'customer';
  bool get isTechnician => role == 'technician';
  bool get isAdmin => role == 'admin' || role == 'super_admin';
}
