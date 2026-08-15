import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../theme/app_colors.dart';

/// A single row in a transaction history timeline.
///
/// Generic over its data (primitives, not a concrete model) so it can render
/// both the customer loyalty-coin ledger ([CoinTransactionModel]) and the
/// technician commission-points ledger ([TechPointTransactionModel]) — the
/// two are separate backend systems with different type enums and fields,
/// but the same visual timeline. Callers resolve their own icon per type
/// (the two domains have disjoint type sets) and pass the rest through.
///
/// Credit transactions show a green + amount; debit transactions show red – amount.
/// Cancelled transactions (loyalty-only concept) render with reduced opacity
/// and a strikethrough.
class TransactionTile extends StatelessWidget {
  const TransactionTile({
    super.key,
    required this.icon,
    required this.typeLabel,
    required this.amount,
    required this.isCredit,
    required this.createdAt,
    this.description,
    this.balanceAfter,
    this.cancelled = false,
    this.expiresAt,
    this.isLast = false,
  });

  final IconData icon;
  final String typeLabel;
  final int amount;
  final bool isCredit;
  final DateTime createdAt;
  final String? description;
  final int? balanceAfter;
  final bool cancelled;
  final DateTime? expiresAt;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;
    final isCancelled = cancelled;

    final amountColor = isCancelled
        ? (isDark ? AppColors.darkMutedForeground : AppColors.lightMutedForeground)
        : isCredit
            ? AppColors.chartGreen
            : AppColors.destructive;

    final amountPrefix = isCredit ? '+' : '−';

    return Opacity(
      opacity: isCancelled ? 0.5 : 1.0,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Timeline spine ─────────────────────────────────────────────
          SizedBox(
            width: 44,
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isCancelled
                        ? (isDark ? AppColors.darkMuted : AppColors.lightMuted)
                        : isCredit
                            ? AppColors.chartGreen.withValues(alpha: 0.12)
                            : AppColors.destructive.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    icon,
                    size: 17,
                    color: isCancelled
                        ? (isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground)
                        : isCredit
                            ? AppColors.chartGreen
                            : AppColors.destructive,
                  ),
                ),
                if (!isLast)
                  Container(
                    width: 1.5,
                    height: 36,
                    color: isDark
                        ? AppColors.darkCardBorder
                        : AppColors.lightCardBorder,
                  ),
              ],
            ),
          ),

          const SizedBox(width: 12),

          // ── Content ────────────────────────────────────────────────────
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          typeLabel,
                          style: textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            decoration: isCancelled
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '$amountPrefix$amount',
                        style: textTheme.bodyMedium?.copyWith(
                          color: amountColor,
                          fontWeight: FontWeight.w800,
                          decoration: isCancelled
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                    ],
                  ),

                  if (description != null && description!.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      description!,
                      style: textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                    ),
                  ],

                  const SizedBox(height: 4),

                  Row(
                    children: [
                      Text(
                        _formatDate(createdAt),
                        style: textTheme.labelSmall?.copyWith(
                          color: isDark
                              ? AppColors.darkMutedForeground
                              : AppColors.lightMutedForeground,
                        ),
                      ),
                      if (balanceAfter != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppColors.darkMutedForeground
                                : AppColors.lightMutedForeground,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'الرصيد: $balanceAfter',
                          style: textTheme.labelSmall?.copyWith(
                            color: isDark
                                ? AppColors.darkMutedForeground
                                : AppColors.lightMutedForeground,
                          ),
                        ),
                      ],
                      if (isCancelled) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppColors.destructive.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'ملغية',
                            style: textTheme.labelSmall?.copyWith(
                              color: AppColors.destructive,
                              fontWeight: FontWeight.w600,
                              fontSize: 9,
                            ),
                          ),
                        ),
                      ],
                      if (expiresAt != null && !isCancelled) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppColors.darkMutedForeground
                                : AppColors.lightMutedForeground,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'تنتهي ${_formatDate(expiresAt!)}',
                          style: textTheme.labelSmall?.copyWith(
                            color: AppColors.gold,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays == 0) return 'اليوم ${DateFormat('HH:mm').format(dt)}';
    if (diff.inDays == 1) return 'أمس';
    if (diff.inDays < 7) return 'منذ ${diff.inDays} أيام';
    return DateFormat('dd/MM/yyyy').format(dt);
  }
}
