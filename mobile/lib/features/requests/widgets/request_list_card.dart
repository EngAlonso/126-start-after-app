import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/request_model.dart';
import '../../../theme/app_colors.dart';
import '../../services/widgets/service_card.dart' show serviceIcon, serviceColor;
import 'request_status_badge.dart';

/// A single request row on the "My Requests" list — service icon, name,
/// short description, created date, offers count, and status badge.
/// Built on real [RequestModel] data (list endpoint only — no nested
/// service/customer objects), unlike the detail screen.
class RequestListCard extends StatelessWidget {
  const RequestListCard({super.key, required this.request, required this.serviceName, this.onTap});

  final RequestModel request;
  final String serviceName;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = serviceColor(request.serviceId);
    final date = _formatDate(request.createdAt);

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
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.04),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDark ? 0.18 : 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(serviceIcon(serviceName), color: color, size: 22),
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
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                              ),
                            ),
                            Text(
                              '#${request.id}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          date,
                          style: TextStyle(
                            fontSize: 11.5,
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                request.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.4,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (request.offersCount > 0) ...[
                    Icon(Icons.local_offer_outlined, size: 14, color: AppColors.gold),
                    const SizedBox(width: 4),
                    Text(
                      '${request.offersCount} عرض',
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.gold),
                    ),
                    const Spacer(),
                  ] else
                    const Spacer(),
                  RequestStatusBadge(status: request.status),
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
    return DateFormat('d MMM yyyy، h:mm a', 'ar').format(parsed.toLocal());
  }
}
