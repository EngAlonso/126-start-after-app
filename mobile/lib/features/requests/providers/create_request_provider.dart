import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/request_model.dart';
import '../../../services/request_service.dart';
import '../../auth/providers/auth_providers.dart';

// ─── Service provider ─────────────────────────────────────────────────────────

final requestServiceProvider = Provider<RequestService>((ref) {
  return RequestService(ref.watch(dioClientProvider).dio);
});

// ─── Submission state ─────────────────────────────────────────────────────────

/// Immutable state for the create-request form's submission lifecycle.
class CreateRequestSubmissionState {
  const CreateRequestSubmissionState({
    this.isSubmitting = false,
    this.errorMessage,
    this.createdRequest,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final RequestModel? createdRequest;

  bool get isSuccess => createdRequest != null;

  CreateRequestSubmissionState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    RequestModel? createdRequest,
    bool clearError = false,
    bool clearRequest = false,
  }) =>
      CreateRequestSubmissionState(
        isSubmitting: isSubmitting ?? this.isSubmitting,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        createdRequest:
            clearRequest ? null : (createdRequest ?? this.createdRequest),
      );
}

// ─── Notifier (Riverpod 3 style) ──────────────────────────────────────────────

class CreateRequestNotifier
    extends Notifier<CreateRequestSubmissionState> {
  @override
  CreateRequestSubmissionState build() =>
      const CreateRequestSubmissionState();

  Future<RequestModel?> submit({
    required int serviceId,
    required String fullName,
    required String mobile,
    required int governorateId,
    required int areaId,
    required String address,
    required String description,
    List<String> images = const [],
    String? audioUrl,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final request =
          await ref.read(requestServiceProvider).createRequest(
                serviceId: serviceId,
                fullName: fullName,
                mobile: mobile,
                governorateId: governorateId,
                areaId: areaId,
                address: address,
                description: description,
                images: images,
                audioUrl: audioUrl,
              );
      state = state.copyWith(isSubmitting: false, createdRequest: request);
      return request;
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '');
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return null;
    }
  }

  void reset() => state = const CreateRequestSubmissionState();
}

final createRequestProvider =
    NotifierProvider.autoDispose<CreateRequestNotifier,
        CreateRequestSubmissionState>(
  CreateRequestNotifier.new,
);
