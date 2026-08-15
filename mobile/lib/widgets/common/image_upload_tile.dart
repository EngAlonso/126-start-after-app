import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/upload_service.dart';
import '../../theme/app_colors.dart';

/// A single "take/choose a photo → upload → show thumbnail" control, used
/// three times by the technician registration wizard (personal photo,
/// national ID front, national ID back). Owns its own picking/uploading
/// state so the parent step only ever needs the resulting URL.
class ImageUploadTile extends StatefulWidget {
  const ImageUploadTile({
    super.key,
    required this.label,
    required this.uploadService,
    required this.category,
    required this.onUploaded,
    this.required = true,
    this.icon = Icons.badge_outlined,
  });

  final String label;
  final UploadService uploadService;
  final UploadCategory category;
  final ValueChanged<String?> onUploaded;
  final bool required;
  final IconData icon;

  @override
  State<ImageUploadTile> createState() => _ImageUploadTileState();
}

class _ImageUploadTileState extends State<ImageUploadTile> {
  String? _localPath;
  String? _remoteUrl;
  bool _isUploading = false;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 85, maxWidth: 1600);
    if (picked == null) return;

    setState(() {
      _localPath = picked.path;
      _isUploading = true;
      _error = null;
    });

    try {
      final uploaded = await widget.uploadService.uploadUserFile(
        filePath: picked.path,
        category: widget.category,
      );
      setState(() {
        _remoteUrl = uploaded.url;
        _isUploading = false;
      });
      widget.onUploaded(uploaded.url);
    } catch (_) {
      setState(() {
        _isUploading = false;
        _error = 'تعذر رفع الصورة، حاول مرة أخرى';
      });
      widget.onUploaded(null);
    }
  }

  void _remove() {
    setState(() {
      _localPath = null;
      _remoteUrl = null;
      _error = null;
    });
    widget.onUploaded(null);
  }

  void _showSourceSheet() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('التقاط صورة'),
              onTap: () {
                Navigator.pop(context);
                _pick(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('اختيار من المعرض'),
              onTap: () {
                Navigator.pop(context);
                _pick(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = _localPath != null;
    final border = _error != null
        ? AppColors.destructive
        : Theme.of(context).colorScheme.outline;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            if (widget.required) const Text(' *', style: TextStyle(color: AppColors.destructive)),
          ],
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: _isUploading ? null : _showSourceSheet,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 130,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: border, style: BorderStyle.solid),
              color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
            ),
            clipBehavior: Clip.antiAlias,
            child: hasImage
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.file(File(_localPath!), fit: BoxFit.cover),
                      if (_isUploading)
                        Container(
                          color: Colors.black.withValues(alpha: 0.45),
                          child: const Center(
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          ),
                        ),
                      if (!_isUploading && _remoteUrl != null)
                        Positioned(
                          top: 6,
                          left: 6,
                          child: CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.black54,
                            child: IconButton(
                              padding: EdgeInsets.zero,
                              icon: const Icon(Icons.close, size: 14, color: Colors.white),
                              onPressed: _remove,
                            ),
                          ),
                        ),
                    ],
                  )
                : Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(widget.icon, size: 28, color: Theme.of(context).colorScheme.onSurfaceVariant),
                        const SizedBox(height: 6),
                        Text(
                          'اضغط لإضافة صورة',
                          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 4),
          Text(_error!, style: const TextStyle(color: AppColors.destructive, fontSize: 12)),
        ],
      ],
    );
  }
}
