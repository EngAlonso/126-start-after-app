import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'auth_session_model.freezed.dart';

/// Result of a successful login/refresh — pairs the token set with the
/// user payload the backend returns alongside it. Kept out of
/// [UserModel] itself since tokens are storage-layer concerns, not user
/// data, and are never persisted as plain JSON (see
/// [SecureStorageService]).
@freezed
abstract class AuthSessionModel with _$AuthSessionModel {
  const factory AuthSessionModel({
    required String accessToken,
    required String refreshToken,
    required UserModel user,
    @Default(<String>[]) List<String> permissions,
  }) = _AuthSessionModel;
}
