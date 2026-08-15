import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../models/user_model.dart';
import '../../../services/profile_service.dart';
import '../../../services/upload_service.dart';

// ── Service providers ─────────────────────────────────────────────────────────

final profileServiceProvider = Provider<ProfileService>((ref) {
  return ProfileService(ref.watch(dioClientProvider).dio);
});

final uploadServiceProvider = Provider<UploadService>((ref) {
  return UploadService(ref.watch(dioClientProvider).dio);
});

// ── Profile notifier ──────────────────────────────────────────────────────────

/// Mirrors the current [UserModel] from [authControllerProvider] and exposes
/// mutation methods that call the backend and then sync the auth state so
/// the rest of the app (home header, etc.) always shows fresh data.
///
/// No extra network call is needed to initialise: the auth state already holds
/// the latest user object from `/auth/me` / login / restore-session.
class ProfileNotifier extends AsyncNotifier<UserModel> {
  @override
  Future<UserModel> build() async {
    final authState = ref.watch(authControllerProvider);
    return authState.when(
      loading: () => Future.error('loading'),
      error: (e, _) => Future.error(e),
      data: (state) => switch (state) {
        Authenticated(:final user) => Future.value(user),
        _ => Future.error('unauthenticated'),
      },
    );
  }

  // ── Photo upload + profile update ────────────────────────────────────────

  /// Uploads [imagePath] to `/upload/user?category=profile`, then patches the
  /// user record with the returned URL. Updates both local and auth state.
  Future<void> uploadAndSetPhoto(String imagePath) async {
    final previous = state.asData?.value;
    if (previous == null) return;

    state = const AsyncValue.loading();
    try {
      final uploaded = await ref
          .read(uploadServiceProvider)
          .uploadUserFile(filePath: imagePath, category: UploadCategory.profilePhoto);

      final updated = await ref.read(profileServiceProvider).updateProfile(
            userId: previous.id,
            profileImage: uploaded.url,
          );

      _sync(updated);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Patches profile fields (name / email / jobTitle, plus the
  /// technician-only services / coverage areas / years of experience). Pass
  /// only the fields the user changed — nulls are skipped by
  /// [ProfileService.updateProfile].
  Future<void> updateProfile({
    String? fullName,
    String? email,
    String? jobTitle,
    List<int>? serviceIds,
    List<int>? areaIds,
    int? yearsOfExperience,
  }) async {
    final previous = state.asData?.value;
    if (previous == null) return;

    state = const AsyncValue.loading();
    try {
      final updated = await ref.read(profileServiceProvider).updateProfile(
            userId: previous.id,
            fullName: fullName,
            email: email,
            jobTitle: jobTitle,
            serviceIds: serviceIds,
            areaIds: areaIds,
            yearsOfExperience: yearsOfExperience,
          );
      _sync(updated);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Changes the user's password via PATCH /users/:id.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final previous = state.asData?.value;
    if (previous == null) return;

    final updated = await ref.read(profileServiceProvider).changePassword(
          userId: previous.id,
          currentPassword: currentPassword,
          newPassword: newPassword,
        );
    _sync(updated);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /// Sets local state and pushes the updated user into [authControllerProvider]
  /// so every widget that reads the auth state (home header, etc.) refreshes.
  void _sync(UserModel updated) {
    state = AsyncValue.data(updated);
    ref.read(authControllerProvider.notifier).refreshUser(updated);
  }
}

final profileProvider =
    AsyncNotifierProvider<ProfileNotifier, UserModel>(ProfileNotifier.new);
