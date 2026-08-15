import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_design.dart';
import 'app_button.dart';

/// Beautiful empty-state placeholder — never show a blank page.
/// Use whenever a list/section has no data yet.
class EmptyStateWidget extends StatelessWidget {
  const EmptyStateWidget({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
    this.iconColor,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Color? iconColor;

  /// If true, uses smaller sizes — suitable for inline section empties.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color  = iconColor ?? AppColors.gold;

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppDesign.spaceXL,
          vertical:   compact ? AppDesign.spaceLG : AppDesign.spaceXXL,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon in a soft-coloured circle
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.7, end: 1.0),
              duration: AppDesign.durationSlow,
              curve: Curves.elasticOut,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Container(
                width:  compact ? 76 : 100,
                height: compact ? 76 : 100,
                decoration: BoxDecoration(
                  color:  color.withValues(alpha: 0.10),
                  shape:  BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color:      color.withValues(alpha: 0.12),
                      blurRadius: 24,
                      offset:     const Offset(0, 8),
                    ),
                  ],
                ),
                child: Icon(icon, size: compact ? 36 : 46, color: color),
              ),
            ),

            SizedBox(height: compact ? 14 : 20),

            // Title
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize:   compact ? 15 : 17,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppColors.darkForeground
                    : AppColors.lightForeground,
              ),
            ),

            const SizedBox(height: 8),

            // Subtitle
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: compact ? 13 : 14,
                color:    isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
                height: 1.55,
              ),
            ),

            // Optional CTA
            if (actionLabel != null && onAction != null) ...[
              SizedBox(height: compact ? 16 : 24),
              SizedBox(
                width: 200,
                child: AppButton(label: actionLabel!, onPressed: onAction),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
