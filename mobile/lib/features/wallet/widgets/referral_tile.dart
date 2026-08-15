import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/referral_model.dart';
import '../../../theme/app_colors.dart';

/// A single row in the referral history list.
class ReferralTile extends StatelessWidget {
  const ReferralTile({super.key, required this.item});

  final ReferralHistoryItem item;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    final isCompleted = item.status == 'completed';
    final isRejected = item.status == 'fraud_flagged';

    final statusColor = isCompleted
        ? AppColors.chartGreen
        : isRejected
            ? AppColors.destructive
            : AppColors.gold;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Row(
        children: [
          // Avatar
          CircleAvatar(
            radius: 20,
            backgroundColor: statusColor.withValues(alpha: 0.12),
            child: Text(
              item.refereeName.isNotEmpty
                  ? item.refereeName[0]
                  : '?',
              style: textTheme.titleSmall?.copyWith(
                color: statusColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Name + date
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.refereeName,
                  style: textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('dd/MM/yyyy').format(item.createdAt),
                  style: textTheme.labelSmall?.copyWith(
                    color: isDark
                        ? AppColors.darkMutedForeground
                        : AppColors.lightMutedForeground,
                  ),
                ),
              ],
            ),
          ),

          // Status badge + reward
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  item.statusLabel,
                  style: textTheme.labelSmall?.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (item.referrerRewarded) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.stars_rounded,
                        color: AppColors.gold, size: 12),
                    const SizedBox(width: 2),
                    Text(
                      'مكافأة مستلمة',
                      style: textTheme.labelSmall?.copyWith(
                        color: AppColors.gold,
                        fontWeight: FontWeight.w600,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
