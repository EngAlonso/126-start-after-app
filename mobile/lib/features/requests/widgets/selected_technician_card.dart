import 'package:flutter/material.dart';

import '../../../core/config/env.dart';
import '../../../models/request_model.dart';
import '../../../theme/app_colors.dart';

/// Shown once a technician has been selected for a request — replaces the
/// offer list/selection UI. Contact info (mobile) is only rendered when the
/// backend actually included it on [technician] (see the phone-visibility
/// gate documented on `RequestPersonInfo.mobile`) — never guessed or
/// fabricated when absent.
class SelectedTechnicianCard extends StatelessWidget {
  const SelectedTechnicianCard({super.key, required this.technician, required this.status});

  final RequestPersonInfo technician;
  final String status;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final image = technician.profileImage;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.chartGreen.withValues(alpha: isDark ? 0.1 : 0.06),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.chartGreen.withValues(alpha: 0.35), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_rounded, color: AppColors.chartGreen, size: 18),
              const SizedBox(width: 6),
              const Text(
                'الفني المختار',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: AppColors.chartGreen),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppColors.gold.withValues(alpha: 0.15),
                backgroundImage:
                    (image != null && image.isNotEmpty) ? NetworkImage(Env.mediaUrl(image)) : null,
                child: (image == null || image.isEmpty)
                    ? Text(
                        technician.fullName.isNotEmpty ? technician.fullName.substring(0, 1) : '?',
                        style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800, fontSize: 18),
                      )
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(technician.fullName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    if (technician.mobile != null && technician.mobile!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.phone_rounded, size: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
                          const SizedBox(width: 4),
                          Text(
                            technician.mobile!,
                            style: TextStyle(fontSize: 12.5, color: Theme.of(context).colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 15, color: Theme.of(context).colorScheme.onSurfaceVariant),
                const SizedBox(width: 6),
                Text(
                  'حالة الطلب: ${status.statusLabelAr}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
