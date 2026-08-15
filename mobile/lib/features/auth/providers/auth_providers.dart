import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../models/user_model.dart';
import '../../../repositories/auth_repository.dart';
import '../../../services/auth_service.dart';

part 'auth_state.dart';

/// Global session-expired signal. The [AuthInterceptor] calls this (via
/// [dioClientProvider]) when a refresh attempt fails outright, so the
/// router can redirect to `/login` even for a background/silent call that
/// no widget is awaiting.
class SessionExpiredCounter extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}

final sessionExpiredProvider = NotifierProvider<SessionExpiredCounter, int>(
  SessionExpiredCounter.new,
);

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final dioClientProvider = Provider<DioClient>((ref) {
  return DioClient(
    storage: ref.watch(secureStorageProvider),
    onSessionExpired: () => ref.read(sessionExpiredProvider.notifier).bump(),
  );
});

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.watch(dioClientProvider).dio);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    authService: ref.watch(authServiceProvider),
    storage: ref.watch(secureStorageProvider),
  );
});

/// Drives auth state + auto-login. `go_router`'s redirect logic
/// (see `app_router.dart`) reads this notifier to decide splash → login
/// vs. splash → home.
final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    // Auto-login: restore whatever session is on disk without blocking on
    // the network — a fast splash → home transition matters more than a
    // guaranteed-fresh user object, and requests will 401-refresh anyway
    // if the cached access token has expired.
    final repository = ref.read(authRepositoryProvider);
    final user = await repository.restoreSession();
    return user == null ? const AuthState.unauthenticated() : AuthState.authenticated(user);
  }

  Future<void> login({
    required String mobile,
    required String password,
    bool rememberMe = true,
  }) async {
    state = const AsyncValue.loading();
    try {
      final user = await ref.read(authRepositoryProvider).login(
            mobile: mobile,
            password: password,
            rememberMe: rememberMe,
          );
      state = AsyncValue.data(AuthState.authenticated(user));
    } on ApiException catch (e) {
      state = AsyncValue.data(AuthState.unauthenticated(errorMessage: e.message));
    }
  }

  /// Customer registration logs the account in immediately (the backend
  /// returns tokens), so it updates [AuthState] exactly like [login].
  Future<void> registerCustomer({
    required String fullName,
    required String mobile,
    required String password,
    String? referredBy,
    bool rememberMe = true,
  }) async {
    state = const AsyncValue.loading();
    try {
      final user = await ref.read(authRepositoryProvider).registerCustomer(
            fullName: fullName,
            mobile: mobile,
            password: password,
            referredBy: referredBy,
            rememberMe: rememberMe,
          );
      state = AsyncValue.data(AuthState.authenticated(user));
    } on ApiException catch (e) {
      state = AsyncValue.data(AuthState.unauthenticated(errorMessage: e.message));
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncValue.data(AuthState.unauthenticated());
  }

  /// Called by [ProfileNotifier] after a successful profile update so the
  /// updated [UserModel] propagates to every widget that reads auth state
  /// (home header, profile screen, etc.) without a round-trip to `/auth/me`.
  void refreshUser(UserModel user) {
    state = AsyncValue.data(AuthState.authenticated(user));
  }
}
