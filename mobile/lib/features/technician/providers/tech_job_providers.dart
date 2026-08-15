import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/requests/providers/create_request_provider.dart';
import '../../../features/requests/providers/request_detail_provider.dart';
import '../../../models/request_model.dart';
import '../providers/tech_providers.dart';

// ── Tab enum ─────────────────────────────────────────────────────────────────

/// The three views inside the My Jobs screen.
enum TechMyJobsTab {
  /// Requests where the technician is currently the assigned technician
  /// and the job is not yet finished (technician_selected / in_progress /
  /// price_change_requested / waiting_approval).
  ongoing,

  /// Requests completed with this technician.
  completed,

  /// Requests this technician cancelled.
  cancelled,
}

extension TechMyJobsTabLabel on TechMyJobsTab {
  String get labelAr => switch (this) {
        TechMyJobsTab.ongoing => 'الجارية',
        TechMyJobsTab.completed => 'المكتملة',
        TechMyJobsTab.cancelled => 'الملغية',
      };
}

// ── State ────────────────────────────────────────────────────────────────────

class TechMyJobsState {
  const TechMyJobsState({
    required this.tab,
    required this.items,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.currentPage = 1,
    this.errorMessage,
  });

  final TechMyJobsTab tab;
  final List<RequestModel> items;
  final bool isLoadingMore;
  final bool hasMore;
  final int currentPage;
  final String? errorMessage;

  TechMyJobsState copyWith({
    TechMyJobsTab? tab,
    List<RequestModel>? items,
    bool? isLoadingMore,
    bool? hasMore,
    int? currentPage,
    String? errorMessage,
    bool clearError = false,
  }) =>
      TechMyJobsState(
        tab: tab ?? this.tab,
        items: items ?? this.items,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        hasMore: hasMore ?? this.hasMore,
        currentPage: currentPage ?? this.currentPage,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

// ── Notifier ─────────────────────────────────────────────────────────────────

/// Manages the technician's My Jobs list across three tabs.
///
/// - **Ongoing**: fetches all four "assigned but not finished" statuses in
///   parallel and merges them — no pagination needed since a technician
///   will rarely have more than a handful of concurrent active jobs.
/// - **Completed**: uses `GET /api/requests/my-completed`, paginated.
/// - **Cancelled**: uses `GET /api/requests?status=cancelled_by_technician`,
///   paginated.
class TechMyJobsNotifier extends AsyncNotifier<TechMyJobsState> {
  @override
  Future<TechMyJobsState> build() => _loadPage(TechMyJobsTab.ongoing, 1);

  // ── Public API ────────────────────────────────────────────────────────

  Future<void> switchTab(TechMyJobsTab tab) async {
    if (state.value?.tab == tab) return;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _loadPage(tab, 1));
  }

  Future<void> refresh() async {
    final tab = state.value?.tab ?? TechMyJobsTab.ongoing;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _loadPage(tab, 1));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.isLoadingMore) return;
    state = AsyncValue.data(current.copyWith(isLoadingMore: true, clearError: true));
    try {
      final next = await _loadPage(current.tab, current.currentPage + 1);
      state = AsyncValue.data(
        TechMyJobsState(
          tab: current.tab,
          items: [...current.items, ...next.items],
          hasMore: next.hasMore,
          currentPage: next.currentPage,
        ),
      );
    } catch (e) {
      state = AsyncValue.data(
        current.copyWith(
          isLoadingMore: false,
          errorMessage: e.toString().replaceFirst('Exception: ', ''),
        ),
      );
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────

  Future<TechMyJobsState> _loadPage(TechMyJobsTab tab, int page) async {
    final svc = ref.read(technicianServiceProvider);
    const limit = 20;

    switch (tab) {
      case TechMyJobsTab.ongoing:
        // Parallel fetch for all four active-job statuses.
        const activeStatuses = [
          'technician_selected',
          'in_progress',
          'price_change_requested',
          'waiting_approval',
        ];
        final results = await Future.wait(
          activeStatuses.map(
            (s) => svc.fetchAvailableRequests(status: s, page: 1, limit: 50),
          ),
        );
        final items = results.expand((r) => r.data).toList()
          ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
        return TechMyJobsState(
          tab: tab,
          items: items,
          hasMore: false, // no pagination for ongoing
          currentPage: 1,
        );

      case TechMyJobsTab.completed:
        final result = await svc.fetchMyCompletedRequests(page: page, limit: limit);
        return TechMyJobsState(
          tab: tab,
          items: result.data,
          hasMore: result.data.length == limit && result.total > page * limit,
          currentPage: page,
        );

      case TechMyJobsTab.cancelled:
        final result = await svc.fetchAvailableRequests(
          status: 'cancelled_by_technician',
          page: page,
          limit: limit,
        );
        return TechMyJobsState(
          tab: tab,
          items: result.data,
          hasMore: result.data.length == limit && result.total > page * limit,
          currentPage: page,
        );
    }
  }
}

final techMyJobsProvider =
    AsyncNotifierProvider<TechMyJobsNotifier, TechMyJobsState>(
  TechMyJobsNotifier.new,
);

// ── Job action state (request-completion / cancel / price-adjustment) ─────────

class TechJobActionState {
  const TechJobActionState({this.isSubmitting = false, this.errorMessage});

  final bool isSubmitting;
  final String? errorMessage;

  TechJobActionState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    bool clearError = false,
  }) =>
      TechJobActionState(
        isSubmitting: isSubmitting ?? this.isSubmitting,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class TechJobActionNotifier extends Notifier<TechJobActionState> {
  @override
  TechJobActionState build() => const TechJobActionState();

  /// `POST /api/requests/:id/request-completion`
  /// Signals the technician has finished. Transitions to `waiting_approval`.
  Future<bool> requestCompletion(int id) => _run(
        () => ref.read(requestServiceProvider).requestCompletion(id),
        id,
      );

  /// `POST /api/requests/:id/cancel` — technician cancels their assignment.
  Future<bool> cancel(int id, {required String reason}) => _run(
        () => ref.read(requestServiceProvider).cancelRequest(id, reason: reason),
        id,
      );

  /// `POST /api/requests/:id/price-adjustment`
  Future<bool> proposePriceAdjustment(
    int id, {
    required double newPrice,
    double newSpareParts = 0,
    String? newDescription,
  }) =>
      _run(
        () => ref.read(technicianServiceProvider).proposePriceAdjustment(
              id,
              newPrice: newPrice,
              newSpareParts: newSpareParts,
              newDescription: newDescription,
            ),
        id,
      );

  Future<bool> _run(Future<void> Function() action, int id) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await action();
      state = state.copyWith(isSubmitting: false);
      // Refresh both the detail and the list.
      ref.invalidate(requestDetailProvider(id));
      ref.invalidate(techMyJobsProvider);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }
}

final techJobActionProvider =
    NotifierProvider.autoDispose<TechJobActionNotifier, TechJobActionState>(
  TechJobActionNotifier.new,
);
