import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/offer_model.dart';
import '../../../services/offer_service.dart';
import '../../auth/providers/auth_providers.dart';
import 'request_detail_provider.dart';

final offerServiceProvider = Provider<OfferService>((ref) {
  return OfferService(ref.watch(dioClientProvider).dio);
});

/// Every offer on one request. `autoDispose` for the same reason as
/// [requestDetailProvider] — no reason to keep a request's offers cached
/// once the user leaves the screen.
final offersProvider = FutureProvider.autoDispose.family<List<OfferModel>, int>((ref, requestId) {
  return ref.watch(offerServiceProvider).fetchOffers(requestId);
});

/// Public technician profile, fetched lazily only when the Offer Details
/// screen is opened (adds `completedJobs`, not present on the offers list).
final technicianPublicProfileProvider =
    FutureProvider.autoDispose.family<TechnicianPublicProfile, int>((ref, technicianUserId) {
  return ref.watch(offerServiceProvider).fetchTechnicianPublicProfile(technicianUserId);
});

/// In-flight state for "اختيار هذا الفني" (select technician).
class OfferSelectionState {
  const OfferSelectionState({this.isSubmitting = false, this.errorMessage});

  final bool isSubmitting;
  final String? errorMessage;

  OfferSelectionState copyWith({bool? isSubmitting, String? errorMessage, bool clearError = false}) =>
      OfferSelectionState(
        isSubmitting: isSubmitting ?? this.isSubmitting,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class OfferSelectionNotifier extends Notifier<OfferSelectionState> {
  @override
  OfferSelectionState build() => const OfferSelectionState();

  /// Calls the real `select` endpoint, then invalidates both the offers
  /// list and the request detail so every screen reflects the new
  /// `technician_selected` status and rejected sibling offers immediately.
  Future<bool> select({required int requestId, required int offerId}) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await ref.read(offerServiceProvider).selectOffer(requestId, offerId);
      state = state.copyWith(isSubmitting: false);
      ref.invalidate(offersProvider(requestId));
      ref.invalidate(requestDetailProvider(requestId));
      return true;
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '');
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return false;
    }
  }
}

final offerSelectionProvider =
    NotifierProvider.autoDispose<OfferSelectionNotifier, OfferSelectionState>(
  OfferSelectionNotifier.new,
);
