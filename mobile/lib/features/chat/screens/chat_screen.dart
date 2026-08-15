import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/message_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../auth/providers/auth_providers.dart';
import '../../../services/upload_service.dart';
import '../providers/chat_provider.dart';
import '../providers/messages_provider.dart';
import '../widgets/chat_avatar.dart';
import '../widgets/chat_composer.dart';
import '../widgets/message_bubble.dart';
import '../widgets/request_context_banner.dart';

/// Phase 7 — Full conversation screen for a single service request.
///
/// [serviceName] / [status] / [otherName] / [otherImage] are supplied via
/// GoRouter `extra` so the AppBar is populated immediately without waiting
/// for messages to load.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    required this.requestId,
    this.serviceName,
    this.status,
    this.otherName,
    this.otherImage,
  });

  final int requestId;
  final String? serviceName;
  final String? status;
  final String? otherName;
  final String? otherImage;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _scrollCtrl = ScrollController();

  /// Optimistic messages appended locally before the server confirms them.
  final List<MessageModel> _optimistic = [];
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Subscribe to SSE — provider auto-disposes on screen close.
      ref.read(chatSseProvider(widget.requestId));
      _markRead();
    });
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _markRead() async {
    try {
      await ref.read(chatServiceProvider).markAllRead(widget.requestId);
    } catch (_) {}
  }

  void _scrollToBottom({bool animate = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      if (animate) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      } else {
        _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
      }
    });
  }

  int get _currentUserId {
    final auth = ref.read(authControllerProvider).value;
    return auth is Authenticated ? auth.user.id : 0;
  }

  Future<void> _sendText(String text) async {
    final userId = _currentUserId;
    final optimistic = MessageModel(
      id: -DateTime.now().millisecondsSinceEpoch,
      requestId: widget.requestId,
      senderId: userId,
      content: text,
      type: 'text',
      isRead: false,
      createdAt: DateTime.now(),
      isOptimistic: true,
    );

    setState(() {
      _optimistic.add(optimistic);
      _isSending = true;
    });
    _scrollToBottom();

    try {
      await ref.read(chatServiceProvider).sendMessage(
            widget.requestId,
            content: text,
          );
      // Remove optimistic, server will provide the confirmed message.
      setState(() {
        _optimistic.removeWhere((m) => m.id == optimistic.id);
        _isSending = false;
      });
      // Add confirmed message and refresh conversation list.
      if (mounted) {
        ref.invalidate(messagesProvider(widget.requestId));
      }
      unawaited(_markRead());
    } catch (_) {
      setState(() {
        final idx = _optimistic.indexWhere((m) => m.id == optimistic.id);
        if (idx >= 0) {
          _optimistic[idx] =
              optimistic.copyWith(isOptimistic: false, isFailed: true);
        }
        _isSending = false;
      });
    }
  }

  Future<void> _sendImage(String filePath) async {
    final userId = _currentUserId;
    final optimistic = MessageModel(
      id: -DateTime.now().millisecondsSinceEpoch,
      requestId: widget.requestId,
      senderId: userId,
      content: '[صورة]',
      type: 'image',
      imageUrl: filePath,
      isRead: false,
      createdAt: DateTime.now(),
      isOptimistic: true,
    );

    setState(() {
      _optimistic.add(optimistic);
      _isSending = true;
    });
    _scrollToBottom();

    try {
      final uploaded = await ref.read(uploadServiceProvider).uploadUserFile(
            filePath: filePath,
            category: UploadCategory.chatImage,
          );
      await ref.read(chatServiceProvider).sendMessage(
            widget.requestId,
            content: '[صورة]',
            type: 'image',
            imageUrl: uploaded.url,
          );
      setState(() {
        _optimistic.removeWhere((m) => m.id == optimistic.id);
        _isSending = false;
      });
      if (mounted) ref.invalidate(messagesProvider(widget.requestId));
      unawaited(_markRead());
    } catch (_) {
      setState(() {
        final idx = _optimistic.indexWhere((m) => m.id == optimistic.id);
        if (idx >= 0) {
          _optimistic[idx] =
              optimistic.copyWith(isOptimistic: false, isFailed: true);
        }
        _isSending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncMessages = ref.watch(messagesProvider(widget.requestId));

    final authData = ref.watch(authControllerProvider).value;
    final currentUserId = authData is Authenticated ? authData.user.id : 0;

    // Scroll to bottom after initial load.
    ref.listen(messagesProvider(widget.requestId), (prev, next) {
      if (next.value != null) _scrollToBottom(animate: false);
    });

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: _buildAppBar(context),
      body: Column(
        children: [
          // Request context banner
          if (widget.serviceName != null)
            RequestContextBanner(
              requestId: widget.requestId,
              serviceName: widget.serviceName!,
              status: widget.status ?? '',
              onTap: () =>
                  context.push(RoutePaths.requestDetail(widget.requestId)),
            ),

          // Messages
          Expanded(
            child: asyncMessages.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.gold),
              ),
              error: (e, _) => _ErrorState(
                onRetry: () =>
                    ref.invalidate(messagesProvider(widget.requestId)),
              ),
              data: (serverMessages) {
                // Merge: server messages first, then any optimistic ones not
                // already confirmed (avoid duplicates by id).
                final serverIds = {for (final m in serverMessages) m.id};
                final merged = [
                  ...serverMessages,
                  ..._optimistic.where((m) => !serverIds.contains(m.id)),
                ];
                return _MessageList(
                  messages: merged,
                  currentUserId: currentUserId,
                  scrollCtrl: _scrollCtrl,
                );
              },
            ),
          ),

          // Composer
          ChatComposer(
            isSending: _isSending,
            onSendText: _sendText,
            onSendImage: _sendImage,
          ),
        ],
      ),
    );
  }

  AppBar _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_forward),
        onPressed: () => context.pop(),
      ),
      title: Row(
        children: [
          ChatAvatar(
            name: widget.otherName ?? '؟',
            imageUrl: widget.otherImage,
            radius: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.otherName ?? 'محادثة',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Message list ──────────────────────────────────────────────────────────────

class _MessageList extends StatelessWidget {
  const _MessageList({
    required this.messages,
    required this.currentUserId,
    required this.scrollCtrl,
  });

  final List<MessageModel> messages;
  final int currentUserId;
  final ScrollController scrollCtrl;

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.chat_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 12),
            Text(
              'لا توجد رسائل بعد\nابدأ المحادثة الآن!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      );
    }

    // Build list with date separators.
    final items = <_ListItem>[];
    DateTime? lastDate;
    for (final msg in messages) {
      final msgDay = DateTime(
          msg.createdAt.year, msg.createdAt.month, msg.createdAt.day);
      if (lastDate == null || lastDate != msgDay) {
        items.add(_DateItem(msgDay));
        lastDate = msgDay;
      }
      items.add(_MsgItem(msg));
    }

    return ListView.builder(
      controller: scrollCtrl,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final item = items[i];
        if (item is _DateItem) {
          return DateSeparator(date: item.date);
        }
        final msgItem = item as _MsgItem;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: MessageBubble(
            message: msgItem.message,
            isMe: msgItem.message.senderId == currentUserId,
          ),
        );
      },
    );
  }
}

sealed class _ListItem {}

class _DateItem extends _ListItem {
  _DateItem(this.date);
  final DateTime date;
}

class _MsgItem extends _ListItem {
  _MsgItem(this.message);
  final MessageModel message;
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
          const SizedBox(height: 12),
          const Text('تعذر تحميل الرسائل', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onRetry,
            child: const Text('إعادة المحاولة'),
          ),
        ],
      ),
    );
  }
}
