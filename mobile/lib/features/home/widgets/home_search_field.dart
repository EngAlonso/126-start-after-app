import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// Large modern search field + a voice-search affordance, UI only — no
/// text field controller wiring or search logic (out of scope for Phase
/// 3A; see `mobile/ARCHITECTURE.md`).
class HomeSearchField extends StatelessWidget {
  const HomeSearchField({super.key, this.onTap, this.onVoiceTap});

  final VoidCallback? onTap;
  final VoidCallback? onVoiceTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark ? AppColors.darkCard : AppColors.lightCard,
      borderRadius: BorderRadius.circular(18),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.05),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(Icons.search_rounded, color: Theme.of(context).colorScheme.onSurfaceVariant),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'عن أي خدمة تبحث؟',
                  style: TextStyle(
                    fontSize: 14.5,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              GestureDetector(
                onTap: onVoiceTap,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.gold),
                  child: const Icon(Icons.mic_none_rounded, size: 19, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
