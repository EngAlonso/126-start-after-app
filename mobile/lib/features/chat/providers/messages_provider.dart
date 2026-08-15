import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/sse/sse_client.dart';
import '../../../models/message_model.dart';
import '../../../services/upload_service.dart';
import '../../auth/providers/auth_providers.dart';
import 'chat_provider.dart';

// ── Message list (read-only, invalidated by SSE) ──────────────────────────────

/// Fetches all messages for a request. The screen calls
/// `ref.invalidate(messagesProvider(requestId))` (or the SSE provider does it
/// automatically) whenever new messages arrive.
final messagesProvider =
    FutureProvider.autoDispose.family<List<MessageModel>, int>(
  (ref, requestId) {
    return ref.read(chatServiceProvider).fetchMessages(requestId);
  },
);

// ── SSE listener per open chat screen ─────────────────────────────────────────

/// Maintains a live SSE connection for [requestId]. Automatically invalidates
/// [messagesProvider] and [conversationsProvider] when a `new_message` event
/// arrives. Disposed when the chat screen is closed (`autoDispose`).
final chatSseProvider =
    StreamProvider.autoDispose.family<void, int>((ref, requestId) async* {
  final storage = ref.watch(secureStorageProvider);
  final client = SseClient(storage: storage, path: ApiEndpoints.userEvents);
  ref.onDispose(client.close);

  await for (final event in client.connect()) {
    if (event.event == 'new_message') {
      try {
        final data = jsonDecode(event.data) as Map<String, dynamic>;
        final eventRequestId = data['requestId'];
        if (eventRequestId == requestId) {
          ref.invalidate(messagesProvider(requestId));
        }
        // Always refresh conversations list to keep unread counts current.
        ref.invalidate(conversationsProvider);
      } catch (_) {
        // Malformed SSE payload — ignore.
      }
    } else if (event.event == 'messages_read') {
      try {
        final data = jsonDecode(event.data) as Map<String, dynamic>;
        if (data['requestId'] == requestId) {
          // Refresh to update read status on outgoing messages.
          ref.invalidate(messagesProvider(requestId));
        }
      } catch (_) {}
    }
    yield null;
  }
});

// ── Upload service provider ───────────────────────────────────────────────────

final uploadServiceProvider = Provider<UploadService>((ref) {
  return UploadService(ref.watch(dioClientProvider).dio);
});
