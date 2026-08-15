import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// Shared "Section title ... View all" row used by every home-screen
/// section (Services, Featured offers, Latest requests) so the section
/// rhythm reads as one consistent system rather than ad-hoc headings.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.actionLabel, this.onActionTap});

  final String title;
  final String? actionLabel;
  final VoidCallback? onActionTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        if (actionLabel != null)
          GestureDetector(
            onTap: onActionTap,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  actionLabel!,
                  style: const TextStyle(color: AppColors.gold, fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const Icon(Icons.chevron_left_rounded, size: 18, color: AppColors.gold),
              ],
            ),
          ),
      ],
    );
  }
}
