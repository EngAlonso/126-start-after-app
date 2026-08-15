import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../models/offer_model.dart';
import '../../../models/request_model.dart';
import '../../../models/tech_point_transaction_model.dart';
import '../../../models/tech_points_model.dart';
import '../../../models/technician_full_profile_model.dart';
import '../../../services/technician_service.dart';
import '../../auth/providers/auth_providers.dart';
import '../../requests/providers/offers_provider.dart';
import '../../requests/providers/request_detail_provider.dart';

// ── Service provider ──────────────────────────────────────────────────────────

final technicianServiceProvider = Provider<TechnicianService>((ref) {
  return TechnicianService(ref.watch(dioClientProvider).dio);
});

// ── Points balance ────────────────────────────────────────────────────────────

/// Non-autoDispose so the dashboard keeps the value while the technician
/// navigates away and back. Invalidated by the SSE provider on relevant events.
final techPointsProvider = FutureProvider<TechPointsModel>((ref) {
  return ref.watch(technicianServiceProvider).fetchPointsBalance();
});

// ── Points transactions (paginated) ─────────────────────────────────────────
//
// Wallet screen (Phase 11D). Structurally mirrors the customer
// `TransactionsNotifier` in wallet_provider.dart, but `/api/points/transactions`
// returns a bare array with a fixed page size and no total-count metadata, so
// `hasMore` is inferred from whether a full page came back (same pattern as
// `TechRequestsNotifier` above) rather than from a `totalPages` field.

const _kTechTxPageSize = 50;

class TechTransactionsState {
  const TechTransactionsState({
    this.items = const [],
    this.page = 1,
    this.hasMore = true,
    this.isLoadingMore = false,
    this.errorMessage,
  });

  final List<TechPointTransactionModel> items;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;
  final String? errorMessage;

  TechTransactionsState copyWith({
    List<TechPointTransactionModel>? items,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
    String? errorMessage,
    bool clearError = false,
  }) =>
      TechTransactionsState(
        items: items ?? this.items,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class TechTransactionsNotifier extends AsyncNotifier<TechTransactionsState> {
  @override
  Future<TechTransactionsState> build() => _fetchFirstPage();

  Future<TechTransactionsState> _fetchFirstPage() async {
    final items = await ref
        .read(technicianServiceProvider)
        .fetchPointTransactions(page: 1);
    return TechTransactionsState(
      items: items,
      page: 1,
      hasMore: items.length >= _kTechTxPageSize,
    );
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(_fetchFirstPage);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue.data(
        current.copyWith(isLoadingMore: true, clearError: true));
    try {
      final nextPage = current.page + 1;
      final items = await ref
          .read(technicianServiceProvider)
          .fetchPointTransactions(page: nextPage);
      state = AsyncValue.data(current.copyWith(
        items: [...current.items, ...items],
        page: nextPage,
        hasMore: items.length >= _kTechTxPageSize,
        isLoadingMore: false,
      ));
    } on ApiException catch (e) {
      state = AsyncValue.data(
          current.copyWith(isLoadingMore: false, errorMessage: e.message));
    }
  }
}

final techTransactionsProvider =
    AsyncNotifierProvider<TechTransactionsNotifier, TechTransactionsState>(
  TechTransactionsNotifier.new,
);

// ── Available requests (paginated + filtered) ─────────────────────────────────

const _kTechPageSize = 20;

/// Filter tabs on the technician requests screen. Maps directly to wire status
/// values; null means "no status filter" (backend returns all discoverable).
enum TechRequestFilter {
  all('الكل', null),
  pending('قيد الانتظار', 'pending'),
  offersReceived('وصلت عروض', 'offers_received'),
  inProgress('قيد التنفيذ', 'in_progress'),
  completed('مكتملة', 'completed');

  const TechRequestFilter(this.label, this.wireStatus);
  final String label;
  final String? wireStatus;
}

class TechRequestsState {
  const TechRequestsState({
    this.items = const [],
    this.page = 1,
    this.hasMore = true,
    this.isLoadingMore = false,
    this.filter = TechRequestFilter.all,
    this.serviceId,
    this.errorMessage,
  });

  final List<RequestModel> items;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;
  final TechRequestFilter filter;
  final int? serviceId;
  final String? errorMessage;

  TechRequestsState copyWith({
    List<RequestModel>? items,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
    TechRequestFilter? filter,
    int? serviceId,
    String? errorMessage,
    bool clearError = false,
    bool clearService = false,
  }) =>
      TechRequestsState(
        items: items ?? this.items,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        filter: filter ?? this.filter,
        serviceId: clearService ? null : (serviceId ?? this.serviceId),
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class TechRequestsNotifier extends AsyncNotifier<TechRequestsState> {
  @override
  Future<TechRequestsState> build() => _fetchFirstPage(TechRequestFilter.all);

  Future<TechRequestsState> _fetchFirstPage(
    TechRequestFilter filter, {
    int? serviceId,
  }) async {
    final result = await ref
        .read(technicianServiceProvider)
        .fetchAvailableRequests(
          page: 1,
          limit: _kTechPageSize,
          status: filter.wireStatus,
          serviceId: serviceId,
        );
    return TechRequestsState(
      items: result.data,
      page: 1,
      hasMore: result.data.length >= _kTechPageSize,
      filter: filter,
      serviceId: serviceId,
    );
  }

  Future<void> refresh() async {
    final current = state.value;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _fetchFirstPage(current?.filter ?? TechRequestFilter.all,
          serviceId: current?.serviceId),
    );
  }

  Future<void> setFilter(TechRequestFilter filter) async {
    if (state.value?.filter == filter) return;
    final serviceId = state.value?.serviceId;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
        () => _fetchFirstPage(filter, serviceId: serviceId));
  }

  Future<void> setServiceFilter(int? serviceId) async {
    final filter = state.value?.filter ?? TechRequestFilter.all;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
        () => _fetchFirstPage(filter, serviceId: serviceId));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue.data(
        current.copyWith(isLoadingMore: true, clearError: true));
    try {
      final nextPage = current.page + 1;
      final result = await ref
          .read(technicianServiceProvider)
          .fetchAvailableRequests(
            page: nextPage,
            limit: _kTechPageSize,
            status: current.filter.wireStatus,
            serviceId: current.serviceId,
          );
      state = AsyncValue.data(current.copyWith(
        items: [...current.items, ...result.data],
        page: nextPage,
        hasMore: result.data.length >= _kTechPageSize,
        isLoadingMore: false,
      ));
    } on ApiException catch (e) {
      state = AsyncValue.data(
          current.copyWith(isLoadingMore: false, errorMessage: e.message));
    }
  }
}

final techRequestsProvider =
    AsyncNotifierProvider<TechRequestsNotifier, TechRequestsState>(
  TechRequestsNotifier.new,
);

// ── Dashboard: latest 5 available requests ────────────────────────────────────

/// Non-paginated snapshot for the home dashboard — just the 5 newest pending
/// requests matching the technician's services/areas.
final techLatestRequestsProvider =
    FutureProvider<List<RequestModel>>((ref) async {
  final result = await ref
      .watch(technicianServiceProvider)
      .fetchAvailableRequests(page: 1, limit: 5, status: 'pending');
  return result.data;
});

// ── Full profile (Phase 11F: Technician Profile) ──────────────────────────────

/// The technician's own catalog data (services, areas, years of experience,
/// approval status, rating) — used by the Technician Profile screen.
/// Family-keyed by user ID to match [technicianPublicProfileProvider]'s shape.
final technicianFullProfileProvider =
    FutureProvider.autoDispose.family<TechnicianFullProfileModel, int>(
        (ref, userId) {
  return ref.watch(technicianServiceProvider).fetchFullProfile(userId);
});

// ── Dashboard: recent finished requests (completed + cancelled) ───────────────

/// Non-paginated snapshot of the 5 most-recent finished requests for the
/// My-Page dashboard.  Fetches completed and cancelled in parallel then
/// merges and sorts by most-recently-updated.
final techRecentFinishedProvider =
    FutureProvider<List<RequestModel>>((ref) async {
  final svc = ref.read(technicianServiceProvider);
  final results = await Future.wait([
    svc.fetchMyCompletedRequests(page: 1, limit: 5),
    svc.fetchAvailableRequests(
        status: 'cancelled_by_technician', page: 1, limit: 5),
  ]);
  final items = [...results[0].data, ...results[1].data];
  items.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  return items.take(5).toList();
});

// ── Own offer for a request ───────────────────────────────────────────────────

/// Derived provider that returns the current technician's own [OfferModel]
/// for [requestId], or null if they have not submitted one yet.
///
/// Uses the shared `offersProvider` (which calls `GET /api/requests/:id/offers`)
/// rather than a separate endpoint — the backend includes all offers; we
/// filter by the technician's own user ID.
final myOfferForRequestProvider =
    Provider.autoDispose.family<OfferModel?, int>((ref, requestId) {
  final authState = ref.watch(authControllerProvider);
  final userId = authState.asData?.value;
  final currentId = userId is Authenticated ? userId.user.id : null;
  if (currentId == null) return null;

  return ref.watch(offersProvider(requestId)).when(
        data: (offers) {
          for (final o in offers) {
            if (o.technicianId == currentId) return o;
          }
          return null;
        },
        loading: () => null,
        error: (_, __) => null,
      );
});

// ── Offer submission / edit state ─────────────────────────────────────────────

class TechOfferState {
  const TechOfferState({
    this.isSubmitting = false,
    this.errorMessage,
    this.successOffer,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final OfferModel? successOffer;

  bool get isSuccess => successOffer != null;

  TechOfferState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    OfferModel? successOffer,
    bool clearError = false,
  }) =>
      TechOfferState(
        isSubmitting: isSubmitting ?? this.isSubmitting,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        successOffer: successOffer ?? this.successOffer,
      );
}

class TechOfferNotifier extends Notifier<TechOfferState> {
  @override
  TechOfferState build() => const TechOfferState();

  Future<bool> submit({
    required int requestId,
    required double price,
    double spareParts = 0,
    String? notes,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final offer = await ref
          .read(technicianServiceProvider)
          .submitOffer(requestId: requestId, price: price, spareParts: spareParts, notes: notes);
      state = state.copyWith(isSubmitting: false, successOffer: offer);
      // Invalidate so the request detail + offers list refresh.
      ref.invalidate(offersProvider(requestId));
      ref.invalidate(requestDetailProvider(requestId));
      ref.invalidate(techLatestRequestsProvider);
      ref.invalidate(techPointsProvider);
      return true;
    } catch (e) {
      state = state.copyWith(
          isSubmitting: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''));
      return false;
    }
  }

  Future<bool> update({
    required int requestId,
    required int offerId,
    required double price,
    double spareParts = 0,
    String? notes,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final offer = await ref
          .read(technicianServiceProvider)
          .updateOffer(requestId: requestId, offerId: offerId, price: price, spareParts: spareParts, notes: notes);
      state = state.copyWith(isSubmitting: false, successOffer: offer);
      ref.invalidate(offersProvider(requestId));
      ref.invalidate(requestDetailProvider(requestId));
      ref.invalidate(techPointsProvider);
      return true;
    } catch (e) {
      state = state.copyWith(
          isSubmitting: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''));
      return false;
    }
  }
}

final techOfferProvider =
    NotifierProvider.autoDispose<TechOfferNotifier, TechOfferState>(
  TechOfferNotifier.new,
);
