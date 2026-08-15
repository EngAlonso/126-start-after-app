---
name: Fnashha Flutter Phase 7 — Chat module
description: Chat architecture decisions and Riverpod 3 family notifier constraints for the chat module.
---

# Flutter Phase 7 — Chat module

## Key architecture decision: no FamilyAsyncNotifier

`FamilyAsyncNotifier<State, Arg>` is **not resolvable** without codegen in flutter_riverpod 3.3.2 (analyzer error: "Classes can only extend other classes"). The non-codegen family async notifier API was effectively removed in Riverpod 3.

**Solution used:**
- `messagesProvider = FutureProvider.autoDispose.family<List<MessageModel>, int>` for the message list (simple, always worked)
- SSE: `chatSseProvider = StreamProvider.autoDispose.family<void, int>` that calls `ref.invalidate(messagesProvider(requestId))` on `new_message` events — no custom notifier needed
- Optimistic UI: managed as local `List<MessageModel> _optimistic` inside a `ConsumerStatefulWidget`; merged with server list at render time
- Sending state: plain `bool _isSending` field in the screen's `State` class

**Why:** FutureProvider.family + local ConsumerStatefulWidget state is simpler, avoids the broken Riverpod 3 family API, and still supports optimistic messages and SSE-driven invalidation.

**How to apply:** Use this pattern for any future "per-requestId" or "per-entity" stateful provider that needs both read (from server) and write (send/mutate) operations.

## File layout
- `mobile/lib/features/chat/providers/chat_provider.dart` — conversationsProvider (AsyncNotifier, single instance)
- `mobile/lib/features/chat/providers/messages_provider.dart` — messagesProvider (FutureProvider.family), chatSseProvider (StreamProvider.family), uploadServiceProvider
- `mobile/lib/features/chat/screens/conversations_screen.dart` — list of all conversations
- `mobile/lib/features/chat/screens/chat_screen.dart` — per-request chat with optimistic UI
- `mobile/lib/features/chat/widgets/` — message_bubble, chat_composer, conversation_tile, chat_avatar, request_context_banner
- `mobile/lib/models/message_model.dart` — plain Dart, no freezed
- `mobile/lib/models/conversation_model.dart` — plain Dart, no freezed
- `mobile/lib/services/chat_service.dart` — fetchConversations, fetchMessages, sendMessage, markAllRead

## Backend API shape (confirmed)
- `GET /api/conversations` → array with request_id, customer_*/technician_* fields, last_message, unread_count
- `GET /api/requests/:id/messages` → array of messages with nested sender {id, fullName, profileImage}
- `POST /api/requests/:id/messages` → {content, type?, imageUrl?}; type is 'text'|'image', no voice
- `PATCH /api/requests/:id/messages/read-all`
- SSE events: `new_message` {requestId, messageId}, `messages_read` {requestId, readBy}
- Images: supported via type='image' + imageUrl; voice notes NOT supported in messages (only on service_requests.audioUrl)

## Entry points wired
- `RequestDetailScreen`: "فتح المحادثة" FilledButton appears when `selectedTechnician != null`
- `HomeHeader`: chat bubble icon added with `onChatTap` callback → `RoutePaths.conversations`
- Routes: `RoutePaths.conversations = '/conversations'`, `RoutePaths.chat(id) = '/requests/{id}/chat'`
