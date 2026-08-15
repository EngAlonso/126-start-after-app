import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/request_model.dart';
import 'create_request_provider.dart';

/// Fetches `GET /api/requests/:id`. `autoDispose` so a detail screen the
/// user navigated away from doesn't keep an authenticated request cached
/// indefinitely; `ref.invalidate` after cancel/complete actions forces a
/// fresh read reflecting the new status.
final requestDetailProvider =
    FutureProvider.autoDispose.family<RequestModel, int>((ref, id) {
  return ref.watch(requestServiceProvider).fetchRequest(id);
});

/// In-flight state for the cancel / reject-completion / approve-completion
/// actions on the detail screen, so the UI can disable buttons and show a
/// spinner without a full-screen reload.
class RequestActionState {
  const RequestActionState({this.isSubmitting = false, this.errorMessage});

  final bool isSubmitting;
  final String? errorMessage;

  RequestActionState copyWith({bool? isSubmitting, String? errorMessage, bool clearError = false}) =>
      RequestActionState(
        isSubmitting: isSubmitting ?? this.isSubmitting,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class RequestActionNotifier extends Notifier<RequestActionState> {
  @override
  RequestActionState build() => const RequestActionState();

  Future<bool> cancel(int id, {required String reason}) => _run(
        () => ref.read(requestServiceProvider).cancelRequest(id, reason: reason),
        id,
      );

  Future<bool> complete(int id) => _run(
        () => ref.read(requestServiceProvider).completeRequest(id),
        id,
      );

  Future<bool> _run(Future<void> Function() action, int id) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await action();
      state = state.copyWith(isSubmitting: false);
      ref.invalidate(requestDetailProvider(id));
      return true;
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '');
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return false;
    }
  }
}

final requestActionProvider =
    NotifierProvider.autoDispose<RequestActionNotifier, RequestActionState>(
  RequestActionNotifier.new,
);
