import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/sse/user_sse_provider.dart';
import '../providers/tech_job_providers.dart';
import '../providers/tech_providers.dart';

/// Derived from [userSseProvider] — the single shared SSE connection.
/// Listens for technician-relevant events and invalidates the appropriate
/// providers so screens refresh automatically.
///
/// Events handled:
/// - `request_created`  → new discoverable request, refresh available list
/// - `request_updated`  → status change or edit, refresh all lists
/// - `status_changed`   → job status transition, refresh all lists
///
/// Non-autoDispose — lives for the entire authenticated session.
/// Anchored by [TechnicianHomeScreen] via `ref.watch(techSseProvider)`.
final techSseProvider = StreamProvider<void>((ref) async* {
  final events = ref.watch(userSseProvider);

  yield* events.when(
    loading: () => const Stream.empty(),
    error: (_, __) => const Stream.empty(),
    data: (event) async* {
      if (event.event == 'request_created' ||
          event.event == 'request_updated' ||
          event.event == 'status_changed') {
        // Broad invalidation — all lists re-fetch on next watch.
        ref.invalidate(techRequestsProvider);
        ref.invalidate(techLatestRequestsProvider);
        ref.invalidate(techPointsProvider);
        // Phase 11B: also refresh the My Jobs list.
        ref.invalidate(techMyJobsProvider);
        // Phase 11D: points balance changes (reserve/release/commission) are
        // driven by the same request/offer lifecycle events, so refresh the
        // wallet's transaction ledger too — no dedicated SSE event exists.
        ref.invalidate(techTransactionsProvider);
      }
      yield null;
    },
  );
});
