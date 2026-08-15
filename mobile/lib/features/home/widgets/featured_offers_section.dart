import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../models/home_demo_data.dart';
import 'section_header.dart';

/// Horizontally-scrolling "featured offers" rail — demo data only.
///
/// Each card shows an icon badge, optional "hot" badge, title, and discount
/// tag. Cards are 150 px wide × 148 px tall with a subtle border and shadow.
class FeaturedOffersSection extends StatelessWidget {
  const FeaturedOffersSection({super.key, this.onViewAllTap});

  final VoidCallback? onViewAllTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'عروض مميزة',
          actionLabel: 'عرض الكل',
          onActionTap: onViewAllTap,
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 148,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            // Reverse so first item appears on the right in RTL
            padding: EdgeInsets.zero,
            itemCount: demoOffers.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _OfferCard(offer: demoOffers[i]),
          ),
        ),
      ],
    );
  }
}

// ─── Offer card ───────────────────────────────────────────────────────────

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer});
  final DemoOffer offer;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: 155,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.22 : 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Icon badge + optional hot-badge row ───────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.gold.withValues(alpha: 0.14),
                ),
                child: Icon(offer.icon, color: AppColors.gold, size: 20),
              ),
              if (offer.badgeLabel != null)
                Flexible(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      offer.badgeLabel!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),

          const Spacer(),

          // ── Title ─────────────────────────────────────────────────
          Text(
            offer.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 6),

          // ── Discount tag ──────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              offer.discount,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.gold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
