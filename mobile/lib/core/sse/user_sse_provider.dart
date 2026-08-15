import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/api_endpoints.dart';
import '../../features/auth/providers/auth_providers.dart';
import 'sse_client.dart';
import 'sse_event.dart';

/// Single persistent SSE connection for the authenticated user event stream.
///
/// Non-autoDispose — lives for the entire authenticated session.
/// All feature providers (notifications, wallet, etc.) should derive from
/// this shared stream rather than opening their own SseClient, so only
/// one HTTP connection is maintained per session.
///
/// Anchor point: [CustomerHomeScreen] watches this (and [notificationsSseProvider],
/// which also watches this) to keep the connection alive.
final userSseProvider = StreamProvider<SseEvent>((ref) async* {
  final storage = ref.watch(secureStorageProvider);
  final client = SseClient(storage: storage, path: ApiEndpoints.userEvents);
  ref.onDispose(client.close);

  await for (final event in client.connect()) {
    yield event;
  }
});
