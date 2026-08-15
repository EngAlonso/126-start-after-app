import 'package:flutter/material.dart';

import '../../../models/service_model.dart';
import '../../../theme/app_colors.dart';

// ─── Icon mapping ─────────────────────────────────────────────────────────────

/// Maps a service's Arabic name to the nearest Material icon.
/// Falls back to [Icons.handyman_rounded] for unrecognised names.
IconData serviceIcon(String nameAr) {
  final n = nameAr.toLowerCase();
  if (n.contains('كهرب')) return Icons.bolt_rounded;
  if (n.contains('سباك')) return Icons.plumbing_rounded;
  if (n.contains('تكييف') || n.contains('تبريد')) return Icons.ac_unit_rounded;
  if (n.contains('نظاف')) return Icons.cleaning_services_rounded;
  if (n.contains('دهان') || n.contains('طلاء')) return Icons.format_paint_rounded;
  if (n.contains('نجار')) return Icons.carpenter_rounded;
  if (n.contains('نقل') || n.contains('عفش')) return Icons.local_shipping_rounded;
  if (n.contains('حداد') || n.contains('حديد')) return Icons.hardware_rounded;
  if (n.contains('شمس') || n.contains('طاقة شمس')) return Icons.solar_power_rounded;
  if (n.contains('زجاج') || n.contains('نافذ')) return Icons.window_rounded;
  if (n.contains('أجهزة') || n.contains('صيانة')) return Icons.kitchen_rounded;
  if (n.contains('سباق') || n.contains('سبق')) return Icons.sports_motorsports_rounded;
  if (n.contains('ري') || n.contains('حديقة')) return Icons.yard_rounded;
  if (n.contains('أمن') || n.contains('كاميرا')) return Icons.security_rounded;
  return Icons.handyman_rounded;
}

/// Deterministic accent colour for a service, cycling over the brand palette.
const _palette = <Color>[
  AppColors.gold,
  AppColors.chartBlue,
  AppColors.chartGreen,
  AppColors.chartPurple,
  Color(0xFFE95A3A),
  Color(0xFF3AB5C4),
];

Color serviceColor(int serviceId) => _palette[serviceId % _palette.length];

// ─── Widget ───────────────────────────────────────────────────────────────────

/// A tappable service tile — icon badge on top, Arabic name below.
/// Used by both the [ServicesScreen] grid and the create-request service picker.
class ServiceCard extends StatelessWidget {
  const ServiceCard({
    super.key,
    required this.service,
    this.onTap,
    this.selected = false,
    this.compact = false,
  });

  final ServiceModel service;
  final VoidCallback? onTap;

  /// Adds a gold outline when the service is the currently-selected choice.
  final bool selected;

  /// Smaller badge size used by the create-request wizard's inline picker.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = serviceColor(service.id);
    final badgeSize = compact ? 52.0 : 62.0;
    final iconSize = compact ? 22.0 : 26.0;
    final fontSize = compact ? 11.0 : 12.0;

    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: selected
              ? Border.all(color: AppColors.gold, width: 2)
              : Border.all(color: Colors.transparent, width: 2),
          color: selected
              ? AppColors.gold.withValues(alpha: 0.08)
              : Colors.transparent,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Icon badge ──────────────────────────────────────────────
            Container(
              width: badgeSize,
              height: badgeSize,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: isDark ? 0.18 : 0.12),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: AppColors.gold.withValues(alpha: 0.3),
                          blurRadius: 10,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: Icon(serviceIcon(service.nameAr), color: color, size: iconSize),
            ),
            const SizedBox(height: 8),

            // ── Label ───────────────────────────────────────────────────
            Text(
              service.nameAr,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                color: selected
                    ? AppColors.gold
                    : Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
