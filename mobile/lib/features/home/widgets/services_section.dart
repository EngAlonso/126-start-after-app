import 'package:flutter/material.dart';

import '../models/home_demo_data.dart';
import 'section_header.dart';

/// The services grid — responsive column count:
/// - Phone (< 500 px wide): 4 columns, 8 items (2 rows)
/// - Tablet (≥ 500 px wide): 6 columns, all items in one row
///
/// Icons only — no service-loading/API wiring (Phase 3A visual prototype).
class ServicesSection extends StatelessWidget {
  const ServicesSection({super.key, this.onViewAllTap, this.onServiceTap, this.maxItems});

  final VoidCallback? onViewAllTap;
  final ValueChanged<DemoService>? onServiceTap;
  /// Maximum number of services to show (defaults to 8 on narrow, all on wide).
  final int? maxItems;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'الخدمات',
          actionLabel: 'عرض الكل',
          onActionTap: onViewAllTap,
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth > 500;
            final crossAxisCount = isWide ? 6 : 4;
            final all   = isWide ? demoServices : demoServices;
            final items = maxItems != null
                ? all.take(maxItems!).toList()
                : (isWide ? all : all.take(8).toList());
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                mainAxisSpacing: 16,
                crossAxisSpacing: isWide ? 10 : 8,
                childAspectRatio: isWide ? 0.80 : 0.78,
              ),
              itemBuilder: (context, i) {
                final service = items[i];
                return _ServiceTile(
                  service: service,
                  onTap: () => onServiceTap?.call(service),
                );
              },
            );
          },
        ),
      ],
    );
  }
}

// ─── Tile ─────────────────────────────────────────────────────────────────

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.service, this.onTap});
  final DemoService service;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon badge
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: service.color.withValues(alpha: isDark ? 0.18 : 0.12),
              boxShadow: [
                BoxShadow(
                  color: service.color.withValues(alpha: isDark ? 0.08 : 0.10),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(service.icon, color: service.color, size: 25),
          ),
          const SizedBox(height: 8),
          Text(
            service.label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
