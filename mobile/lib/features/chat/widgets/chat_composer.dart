import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../theme/app_colors.dart';

/// The message input bar at the bottom of the chat screen.
///
/// Emits [onSendText] for text messages and [onSendImage] for images picked
/// from the gallery or camera. Voice recording is not supported by the backend
/// messages schema so it is intentionally omitted here.
class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    required this.onSendText,
    required this.onSendImage,
    this.isSending = false,
  });

  final Future<void> Function(String text) onSendText;
  final Future<void> Function(String filePath) onSendImage;
  final bool isSending;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  bool _hasText = false;
  bool _isPickingImage = false;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(() {
      final hasText = _ctrl.text.trim().isNotEmpty;
      if (hasText != _hasText) setState(() => _hasText = hasText);
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _sendText() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || widget.isSending) return;
    _ctrl.clear();
    setState(() => _hasText = false);
    await widget.onSendText(text);
  }

  Future<void> _pickImage(ImageSource source) async {
    if (_isPickingImage) return;
    setState(() => _isPickingImage = true);
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: source,
        imageQuality: 80,
        maxWidth: 1600,
      );
      if (picked != null) {
        await widget.onSendImage(picked.path);
      }
    } finally {
      if (mounted) setState(() => _isPickingImage = false);
    }
  }

  void _showImageSourceSheet() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('من المعرض'),
              onTap: () {
                Navigator.pop(ctx);
                unawaited(_pickImage(ImageSource.gallery));
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('التقاط صورة'),
              onTap: () {
                Navigator.pop(ctx);
                unawaited(_pickImage(ImageSource.camera));
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: EdgeInsets.only(
        left: 8,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom > 0
            ? 8
            : MediaQuery.of(context).padding.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Image attach button
          IconButton(
            icon: _isPickingImage
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.gold,
                    ),
                  )
                : const Icon(Icons.image_outlined),
            color: AppColors.gold,
            onPressed: _isPickingImage ? null : _showImageSourceSheet,
            tooltip: 'إرسال صورة',
          ),

          // Text field
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 120),
              child: TextField(
                controller: _ctrl,
                focusNode: _focus,
                textDirection: TextDirection.rtl,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: 'اكتب رسالة…',
                  hintTextDirection: TextDirection.rtl,
                  filled: true,
                  fillColor: isDark
                      ? AppColors.darkBackground
                      : AppColors.lightBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(width: 6),

          // Send button
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _hasText
                ? GestureDetector(
                    key: const ValueKey('send'),
                    onTap: widget.isSending ? null : _sendText,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        shape: BoxShape.circle,
                      ),
                      child: widget.isSending
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                    ),
                  )
                : const SizedBox(key: ValueKey('empty'), width: 44),
          ),
        ],
      ),
    );
  }
}
