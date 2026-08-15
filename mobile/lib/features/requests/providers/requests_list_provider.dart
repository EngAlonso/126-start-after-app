import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../models/request_model.dart';
import '../../requests/providers/create_request_provider.dart';

/// Filter tabs shown above the "My Requests" list. Every value except
/// [all] and [cancelled] maps 1:1 onto a single backend status value
/// (see `RequestModel.RequestStatus`) so the server can filter directly;
/// [all] sends no `status` param and [cancelled] aggregates all three
/// `cancelled_by_*` statuses client-side since the backend only supports
/// filtering by one exact status at a time.
enum RequestFilter {
  all('الكل'),
  open('مفتوحة'),
  offersReceived('وصلت عروض'),
  technicianSelected('تم اختيار فني'),
  inProgress('قيد التنفيذ'),
  waitingApproval('بانتظار الموافقة'),
  completed('مكتملة'),
  cancelled('ملغاة');

  const RequestFilter(this.label);
  final String label;

  /// Null means "no server-side status filter" (client-side filtering, or
  /// no filtering at all, applies instead).
  String? get wireStatus => switch (this) {
        RequestFilter.all => null,
        RequestFilter.open => 'pending',
        RequestFilter.offersReceived => 'offers_received',
        RequestFilter.technicianSelected => 'technician_selected',
        RequestFilter.inProgress => 'in_progress',
        RequestFilter.waitingApproval => 'waiting_approval',
        RequestFilter.completed => 'completed',
        RequestFilter.cancelled => null,
      };
}

const _pageSize = 20;

/// Immutable snapshot of the "My Requests" list screen.
class MyRequestsState {
  const MyRequestsState({
    this.items = const [],
    this.page = 1,
    this.hasMore = true,
    this.isLoadingMore = false,
    this.filter = RequestFilter.all,
    this.searchQuery = '',
    this.errorMessage,
  });

  final List<RequestModel> items;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;
  final RequestFilter filter;
  final String searchQuery;
  final String? errorMessage;

  /// Client-side search over the already-fetched page — the backend has no
  /// full-text search param on `GET /requests`, so this narrows what's
  /// already loaded by service name / description, matching what the user
  /// sees rather than silently querying more from the server.
  List<RequestModel> get visibleItems {
    var result = items;
    if (filter == RequestFilter.cancelled) {
      result = result.where((r) => r.status.isCancelled).toList();
    }
    final q = searchQuery.trim().toLowerCase();
    if (q.isEmpty) return result;
    return result
        .where((r) =>
            r.description.toLowerCase().contains(q) ||
            (r.service?.nameAr.toLowerCase().contains(q) ?? false) ||
            r.address.toLowerCase().contains(q))
        .toList();
  }

  MyRequestsState copyWith({
    List<RequestModel>? items,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
    RequestFilter? filter,
    String? searchQuery,
    String? errorMessage,
    bool clearError = false,
  }) =>
      MyRequestsState(
        items: items ?? this.items,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        filter: filter ?? this.filter,
        searchQuery: searchQuery ?? this.searchQuery,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

/// Drives the "My Requests" screen: initial load, pull-to-refresh,
/// infinite-scroll pagination, status filter tabs, and client-side search.
class MyRequestsNotifier extends AsyncNotifier<MyRequestsState> {
  @override
  Future<MyRequestsState> build() => _fetchFirstPage(RequestFilter.all);

  Future<MyRequestsState> _fetchFirstPage(RequestFilter filter) async {
    final result = await ref.read(requestServiceProvider).fetchRequests(
          page: 1,
          limit: _pageSize,
          status: filter.wireStatus,
        );
    return MyRequestsState(
      items: result.data,
      page: 1,
      hasMore: result.data.length >= _pageSize,
      filter: filter,
    );
  }

  Future<void> refresh() async {
    final filter = state.value?.filter ?? RequestFilter.all;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetchFirstPage(filter));
  }

  Future<void> setFilter(RequestFilter filter) async {
    if (state.value?.filter == filter) return;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetchFirstPage(filter));
  }

  void setSearchQuery(String query) {
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(searchQuery: query));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue.data(current.copyWith(isLoadingMore: true, clearError: true));
    try {
      final nextPage = current.page + 1;
      final result = await ref.read(requestServiceProvider).fetchRequests(
            page: nextPage,
            limit: _pageSize,
            status: current.filter.wireStatus,
          );
      state = AsyncValue.data(
        current.copyWith(
          items: [...current.items, ...result.data],
          page: nextPage,
          hasMore: result.data.length >= _pageSize,
          isLoadingMore: false,
        ),
      );
    } on ApiException catch (e) {
      state = AsyncValue.data(
        current.copyWith(isLoadingMore: false, errorMessage: e.message),
      );
    }
  }
}

final myRequestsProvider = AsyncNotifierProvider<MyRequestsNotifier, MyRequestsState>(
  MyRequestsNotifier.new,
);
