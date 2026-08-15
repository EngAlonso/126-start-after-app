import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// A compact banner pinned at the top of the chat screen that shows the
/// service request summary — service name, request status, and a link to
/// the full request detail screen.
class RequestContextBanner extends StatelessWidget {
  const RequestContextBanner({
    super.key,
    required this.requestId,
    required this.serviceName,
    required this.status,
    this.onTap,
  });

  final int requestId;
  final String serviceName;
  final String status;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSecondary : AppColors.lightSecondary,
          border: Border(
            bottom: BorderSide(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.gold.withAlpha(30),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.home_repair_service_outlined,
                color: AppColors.gold,
                size: 16,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    serviceName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    _statusLabel(status),
                    style: TextStyle(
                      fontSize: 11,
                      color:
                          Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(Icons.chevron_left, size: 16, color: AppColors.gold),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String s) => switch (s) {
        'pending' => 'مفتوح',
        'offers_received' => 'وصلت عروض',
        'technician_selected' => 'تم اختيار فني',
        'in_progress' => 'قيد التنفيذ',
        'waiting_approval' => 'بانتظار الموافقة',
        'completed' => 'مكتمل',
        'cancelled_by_customer' ||
        'cancelled_by_technician' ||
        'cancelled_by_admin' =>
          'ملغي',
        _ => s,
      };
}
