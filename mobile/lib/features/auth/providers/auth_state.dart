part of 'auth_providers.dart';

/// Deliberately plain (not freezed) — this is UI-facing view state, not a
/// backend model, and stays tiny enough that a sealed class + factories is
/// clearer than generated union boilerplate.
sealed class AuthState {
  const AuthState();

  const factory AuthState.authenticated(UserModel user) = Authenticated;
  const factory AuthState.unauthenticated({String? errorMessage}) = Unauthenticated;
}

final class Authenticated extends AuthState {
  const Authenticated(this.user);
  final UserModel user;
}

final class Unauthenticated extends AuthState {
  const Unauthenticated({this.errorMessage});
  final String? errorMessage;
}
