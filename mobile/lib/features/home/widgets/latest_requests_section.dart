import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../models/home_demo_data.dart';
import 'section_header.dart';

/// Vertical list of modern "request" cards — demo data only, no requests
/// service/API wiring per Phase 3A scope.
///
/// Each card shows: service icon, service name, technician + date row,
/// optional price, and status badge.
class LatestRequestsSection extends StatelessWidget {
  const LatestRequestsSection({
    super.key,
    this.onViewAllTap,
    this.onRequestTap,
  });

  final VoidCallback? onViewAllTap;
  final ValueChanged<DemoRequest>? onRequestTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'أحدث الطلبات',
          actionLabel: 'عرض الكل',
          onActionTap: onViewAllTap,
        ),
        const SizedBox(height: 14),
        ...List.generate(demoRequests.length, (i) {
          final request = demoRequests[i];
          return Padding(
            padding:
                EdgeInsets.only(bottom: i == demoRequests.length - 1 ? 0 : 12),
            child: _RequestCard(
              request: request,
              onTap: () => onRequestTap?.call(request),
            ),
          );
        }),
      ],
    );
  }
}

// ─── Request card ─────────────────────────────────────────────────────────

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, this.onTap});
  final DemoRequest request;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: isDark ? AppColors.darkCard : AppColors.lightCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color:
                  isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.04),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            children: [
              // ── Service icon ─────────────────────────────────────
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(request.icon, color: AppColors.gold, size: 22),
              ),
              const SizedBox(width: 12),

              // ── Service name + technician/date ───────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.serviceName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${request.technicianName} · ${request.date}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    // Price (when available)
                    if (request.price != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        request.price!,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gold,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // ── Status badge ─────────────────────────────────────
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: request.status.color.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  request.status.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: request.status.color,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
