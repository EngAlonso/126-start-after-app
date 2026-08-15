import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/request_model.dart';
import '../../../theme/app_colors.dart';
import '../../requests/widgets/request_status_badge.dart';
import '../../services/widgets/service_card.dart' show serviceIcon, serviceColor;

/// Technician-facing request card — richer than the customer card because
/// the technician needs to see location, price signals, and media indicators
/// before deciding whether to submit an offer.
class TechRequestCard extends StatelessWidget {
  const TechRequestCard({
    super.key,
    required this.request,
    required this.serviceName,
    required this.areaName,
    required this.governorateName,
    this.onTap,
    this.onChatTap,
  });

  final RequestModel request;
  final String serviceName;
  final String areaName;
  final String governorateName;
  final VoidCallback? onTap;

  /// Optional quick action — shows a chat icon in the footer row when
  /// provided (e.g. once a technician is assigned to the request so a
  /// conversation exists). Reuses the same chat entry point as Job Details.
  final VoidCallback? onChatTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = serviceColor(request.serviceId);
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : AppColors.lightCard,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.04),
                blurRadius: 14,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Service + status ──────────────────────────────────────
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDark ? 0.18 : 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(serviceIcon(serviceName), color: color, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                serviceName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 14.5, fontWeight: FontWeight.w800),
                              ),
                            ),
                            Text(
                              '#${request.id}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        // Location
                        Row(
                          children: [
                            Icon(Icons.location_on_rounded,
                                size: 13,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                '$governorateName • $areaName',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // ── Description ───────────────────────────────────────────
              Text(
                request.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodyMedium?.copyWith(
                  height: 1.45,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),

              const SizedBox(height: 12),

              // ── Footer row ────────────────────────────────────────────
              Row(
                children: [
                  // Date
                  Icon(Icons.access_time_rounded,
                      size: 13,
                      color:
                          Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 3),
                  Text(
                    _formatDate(request.createdAt),
                    style: textTheme.bodySmall?.copyWith(
                      color:
                          Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 11,
                    ),
                  ),

                  // Media indicators
                  if (request.images.isNotEmpty) ...[
                    const SizedBox(width: 10),
                    Icon(Icons.photo_library_rounded,
                        size: 13, color: AppColors.gold),
                    const SizedBox(width: 3),
                    Text(
                      '${request.images.length}',
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.gold,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                  if (request.audioUrl != null) ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.mic_rounded, size: 13, color: AppColors.gold),
                  ],

                  const Spacer(),

                  // Offers count
                  if (request.offersCount > 0) ...[
                    Icon(Icons.local_offer_outlined,
                        size: 13, color: AppColors.gold),
                    const SizedBox(width: 3),
                    Text(
                      '${request.offersCount}',
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.gold,
                          fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 8),
                  ],

                  RequestStatusBadge(status: request.status, dense: true),

                  if (onChatTap != null) ...[
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: onChatTap,
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.chat_bubble_outline_rounded,
                          size: 15,
                          color: AppColors.gold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _formatDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('d MMM، h:mm a', 'ar').format(parsed.toLocal());
  }
}
