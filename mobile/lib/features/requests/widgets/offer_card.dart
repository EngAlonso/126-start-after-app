import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/config/env.dart';
import '../../../models/offer_model.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import 'offer_status_badge.dart';

/// Which comparison badge(s) this offer earns among its siblings — computed
/// once per list by [computeOfferHighlights] and passed in, never guessed
/// per-card, so "best price" always means best across the *whole* list.
class OfferHighlights {
  const OfferHighlights({this.isBestPrice = false, this.isTopRated = false});

  final bool isBestPrice;
  final bool isTopRated;

  bool get hasAny => isBestPrice || isTopRated;
}

/// Compares every pending offer in [offers] and flags the cheapest total
/// price and the highest technician rating. Only flags a dimension that
/// actually varies and only when the backend supplied real data (a rating
/// of 0 doesn't count as "top rated") — never fabricates a winner among a
/// single offer or all-equal offers.
Map<int, OfferHighlights> computeOfferHighlights(List<OfferModel> offers) {
  final pending = offers.where((o) => o.isPending).toList();
  if (pending.length < 2) return {};

  final cheapest = pending.reduce((a, b) => a.totalPrice <= b.totalPrice ? a : b);
  final ratedOffers = pending.where((o) => (o.technician?.averageRating ?? 0) > 0).toList();
  OfferModel? topRated;
  if (ratedOffers.length >= 2) {
    topRated = ratedOffers.reduce(
      (a, b) => (a.technician!.averageRating) >= (b.technician!.averageRating) ? a : b,
    );
  }

  final result = <int, OfferHighlights>{};
  for (final offer in pending) {
    final isBest = offer.id == cheapest.id;
    final isTop = topRated != null && offer.id == topRated.id;
    if (isBest || isTop) {
      result[offer.id] = OfferHighlights(isBestPrice: isBest, isTopRated: isTop);
    }
  }
  return result;
}

/// Premium Material 3 offer card: technician identity, rating, price
/// breakdown, notes, submission date, and (when [onSelect] is provided) the
/// "اختيار هذا الفني" call-to-action.
class OfferCard extends StatelessWidget {
  const OfferCard({
    super.key,
    required this.offer,
    this.highlights = const OfferHighlights(),
    this.onTap,
    this.onSelect,
    this.isSelecting = false,
  });

  final OfferModel offer;
  final OfferHighlights highlights;
  final VoidCallback? onTap;
  final VoidCallback? onSelect;
  final bool isSelecting;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tech = offer.technician;
    final borderColor = offer.isSelected
        ? AppColors.chartGreen
        : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder);

    return Material(
      color: offer.isSelected
          ? AppColors.chartGreen.withValues(alpha: isDark ? 0.1 : 0.06)
          : (isDark ? AppColors.darkCard : AppColors.lightCard),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: borderColor, width: offer.isSelected ? 1.5 : 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Highlight chips ──────────────────────────────────────────
              if (highlights.hasAny) ...[
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (highlights.isBestPrice)
                      const _HighlightChip(icon: Icons.savings_rounded, label: 'أفضل سعر', color: AppColors.chartGreen),
                    if (highlights.isTopRated)
                      const _HighlightChip(icon: Icons.star_rounded, label: 'الأعلى تقييماً', color: AppColors.gold),
                  ],
                ),
                const SizedBox(height: 10),
              ],

              // ── Identity row ─────────────────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Avatar(tech: tech),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                offer.isAdminOffer ? 'عرض من الإدارة' : (tech?.fullName ?? 'فني'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                              ),
                            ),
                          ],
                        ),
                        if (!offer.isAdminOffer && (tech?.averageRating ?? 0) > 0) ...[
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              const Icon(Icons.star_rounded, size: 15, color: AppColors.gold),
                              const SizedBox(width: 2),
                              Text(
                                tech!.averageRating.toStringAsFixed(1),
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '(${tech.reviewCount} تقييم)',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 3),
                        Text(
                          _formatDate(offer.createdAt),
                          style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  OfferStatusBadge(status: offer.status),
                ],
              ),

              const SizedBox(height: 14),

              // ── Price breakdown ──────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkMuted : AppColors.lightMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _PriceCell(label: 'الخدمة', value: offer.price),
                    ),
                    if (offer.spareParts > 0)
                      Expanded(
                        child: _PriceCell(label: 'قطع الغيار', value: offer.spareParts, color: Colors.orange.shade700),
                      ),
                    Expanded(
                      child: _PriceCell(label: 'الإجمالي', value: offer.totalPrice, isTotal: true),
                    ),
                  ],
                ),
              ),

              if (offer.notes != null && offer.notes!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  offer.notes!,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
                ),
              ],

              if (onSelect != null) ...[
                const SizedBox(height: 14),
                AppButton(
                  label: 'اختيار هذا الفني',
                  isLoading: isSelecting,
                  onPressed: isSelecting ? null : onSelect,
                ),
              ],
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

class _Avatar extends StatelessWidget {
  const _Avatar({required this.tech});
  final OfferTechnicianInfo? tech;

  @override
  Widget build(BuildContext context) {
    if (tech == null) {
      return CircleAvatar(
        radius: 24,
        backgroundColor: Colors.purple.withValues(alpha: 0.12),
        child: const Text('إد', style: TextStyle(color: Colors.purple, fontWeight: FontWeight.w800)),
      );
    }
    final image = tech!.profileImage;
    return CircleAvatar(
      radius: 24,
      backgroundColor: AppColors.gold.withValues(alpha: 0.15),
      backgroundImage: (image != null && image.isNotEmpty) ? NetworkImage(Env.mediaUrl(image)) : null,
      child: (image == null || image.isEmpty)
          ? Text(
              tech!.fullName.isNotEmpty ? tech!.fullName.substring(0, 1) : '?',
              style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800, fontSize: 16),
            )
          : null,
    );
  }
}

class _PriceCell extends StatelessWidget {
  const _PriceCell({required this.label, required this.value, this.isTotal = false, this.color});
  final String label;
  final double value;
  final bool isTotal;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 10.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        const SizedBox(height: 2),
        Text(
          '${value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 2)} ج',
          style: TextStyle(
            fontSize: isTotal ? 15.5 : 13,
            fontWeight: FontWeight.w800,
            color: color ?? (isTotal ? null : AppColors.gold),
          ),
        ),
      ],
    );
  }
}

class _HighlightChip extends StatelessWidget {
  const _HighlightChip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12.5, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}
