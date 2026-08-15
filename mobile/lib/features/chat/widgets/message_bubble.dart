import 'dart:io';

import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';

import '../../../models/message_model.dart';
import '../../../theme/app_colors.dart';

/// A single chat bubble — sent (right/gold) or received (left/card).
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    this.showSenderName = false,
  });

  final MessageModel message;
  final bool isMe;
  final bool showSenderName;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bubbleColor = isMe
        ? AppColors.gold
        : (isDark ? AppColors.darkCard : AppColors.lightCard);

    final textColor = isMe
        ? Colors.white
        : (isDark ? AppColors.darkForeground : AppColors.lightForeground);

    final borderRadius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft:
          isMe ? const Radius.circular(18) : const Radius.circular(4),
      bottomRight:
          isMe ? const Radius.circular(4) : const Radius.circular(18),
    );

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.72,
        ),
        child: Container(
          margin: EdgeInsets.only(
            top: 2,
            bottom: 2,
            left: isMe ? 48 : 0,
            right: isMe ? 0 : 48,
          ),
          decoration: BoxDecoration(
            color: message.isFailed
                ? AppColors.destructive.withAlpha(200)
                : bubbleColor,
            borderRadius: borderRadius,
            border: isMe
                ? null
                : Border.all(
                    color: isDark
                        ? AppColors.darkCardBorder
                        : AppColors.lightCardBorder,
                  ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(10),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (showSenderName && !isMe && message.senderName != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      message.senderName!,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gold,
                      ),
                    ),
                  ),

                // Content
                if (message.type == 'image')
                  _ImageContent(message: message, isMe: isMe)
                else
                  Text(
                    message.content,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 14.5,
                      height: 1.45,
                    ),
                    textDirection: TextDirection.rtl,
                  ),

                const SizedBox(height: 4),

                // Timestamp + status row
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _formatTime(message.createdAt),
                      style: TextStyle(
                        fontSize: 10.5,
                        color: isMe
                            ? Colors.white.withAlpha(180)
                            : Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant,
                      ),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 4),
                      _statusIcon(message),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statusIcon(MessageModel msg) {
    if (msg.isFailed) {
      return const Icon(Icons.error_outline, size: 12, color: Colors.white70);
    }
    if (msg.isOptimistic) {
      return const SizedBox(
        width: 10,
        height: 10,
        child: CircularProgressIndicator(
          strokeWidth: 1.5,
          color: Colors.white70,
        ),
      );
    }
    return Icon(
      msg.isRead ? Icons.done_all : Icons.done,
      size: 13,
      color: Colors.white.withAlpha(180),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

// ── Image content ─────────────────────────────────────────────────────────────

class _ImageContent extends StatelessWidget {
  const _ImageContent({required this.message, required this.isMe});
  final MessageModel message;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final src = message.imageUrl ?? '';
    final isLocal = src.isNotEmpty &&
        !src.startsWith('http://') &&
        !src.startsWith('https://');

    final ImageProvider imageProvider = isLocal
        ? FileImage(File(src))
        : NetworkImage(src) as ImageProvider;

    return GestureDetector(
      onTap: () => _openPhoto(context, imageProvider),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image(
          image: imageProvider,
          width: 200,
          height: 200,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 200,
            height: 100,
            color: Colors.black12,
            child:
                const Icon(Icons.broken_image_outlined, color: Colors.grey),
          ),
        ),
      ),
    );
  }

  void _openPhoto(BuildContext context, ImageProvider provider) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
            leading: IconButton(
              icon: const Icon(Icons.arrow_forward),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: PhotoView(imageProvider: provider),
        ),
      ),
    );
  }
}

// ── Date separator ────────────────────────────────────────────────────────────

/// Shown between messages from different days.
class DateSeparator extends StatelessWidget {
  const DateSeparator({super.key, required this.date});
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color:
              Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          _formatDate(date),
          style: TextStyle(
            fontSize: 11.5,
            color:
                Theme.of(context).colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(msgDay).inDays;
    if (diff == 0) return 'اليوم';
    if (diff == 1) return 'أمس';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
