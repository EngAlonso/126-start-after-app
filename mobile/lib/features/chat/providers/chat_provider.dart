import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/conversation_model.dart';
import '../../../services/chat_service.dart';
import '../../auth/providers/auth_providers.dart';

// ── Service provider ──────────────────────────────────────────────────────────

final chatServiceProvider = Provider<ChatService>((ref) {
  return ChatService(ref.watch(dioClientProvider).dio);
});

// ── Conversations list ────────────────────────────────────────────────────────

/// Fetches and exposes all conversations for the current user.
/// Call `ref.read(conversationsProvider.notifier).refresh()` after an SSE
/// `new_message` event to keep the list current.
class ConversationsNotifier extends AsyncNotifier<List<ConversationModel>> {
  @override
  Future<List<ConversationModel>> build() {
    return ref.read(chatServiceProvider).fetchConversations();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(chatServiceProvider).fetchConversations(),
    );
  }
}

final conversationsProvider =
    AsyncNotifierProvider<ConversationsNotifier, List<ConversationModel>>(
  ConversationsNotifier.new,
);
