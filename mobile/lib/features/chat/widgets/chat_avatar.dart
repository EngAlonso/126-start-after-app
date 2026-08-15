import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// Circular avatar for chat — shows a network image if available,
/// otherwise falls back to an initials badge.
class ChatAvatar extends StatelessWidget {
  const ChatAvatar({
    super.key,
    required this.name,
    this.imageUrl,
    this.radius = 20,
  });

  final String name;
  final String? imageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.gold.withAlpha(30),
      backgroundImage:
          (imageUrl != null && imageUrl!.isNotEmpty) ? NetworkImage(imageUrl!) : null,
      child: (imageUrl == null || imageUrl!.isEmpty)
          ? Text(
              initials,
              style: TextStyle(
                fontSize: radius * 0.6,
                fontWeight: FontWeight.w700,
                color: AppColors.gold,
              ),
            )
          : null,
    );
  }

  String _initials(String n) {
    final parts = n.trim().split(' ');
    if (parts.isEmpty) return '؟';
    if (parts.length == 1) return parts[0].isEmpty ? '؟' : parts[0][0];
    return '${parts[0][0]}${parts[1][0]}';
  }
}
