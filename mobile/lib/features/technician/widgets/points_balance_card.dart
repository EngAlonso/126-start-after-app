import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/tech_points_model.dart';
import '../../../theme/app_colors.dart';
import '../providers/tech_providers.dart';

/// Gradient card showing the technician's commission-points balance
/// (available / total / reserved), reading [techPointsProvider].
///
/// Originally the dashboard-only `_PointsCard` (Phase 11A); extracted as a
/// public, reusable widget in Phase 11D so the Technician Wallet screen and
/// the dashboard render an identical balance header instead of duplicating
/// the gradient/typography/layout.
class PointsBalanceCard extends ConsumerWidget {
  const PointsBalanceCard({super.key, this.onTap});

  /// Optional tap handler — the dashboard uses this to push the wallet
  /// screen; the wallet screen itself passes null (it's already there).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pointsAsync = ref.watch(techPointsProvider);

    final card = Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFFE9B73A), Color(0xFFD4922A)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.gold.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: pointsAsync.when(
        loading: () => const Center(
          child: SizedBox(
            height: 40,
            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
          ),
        ),
        error: (_, __) => const Center(
          child: Text('تعذر تحميل الرصيد', style: TextStyle(color: Colors.white)),
        ),
        data: (pts) => _PointsCardContent(pts: pts, tappable: onTap != null),
      ),
    );

    if (onTap == null) return card;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: card,
    );
  }
}

class _PointsCardContent extends StatelessWidget {
  const _PointsCardContent({required this.pts, required this.tappable});

  final TechPointsModel pts;
  final bool tappable;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.stars_rounded, color: Colors.white, size: 32),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('رصيد النقاط المتاح',
                  style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500)),
              Text(
                '${pts.available}',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    height: 1.1),
              ),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            _PtsMeta(label: 'الرصيد الكلي', value: '${pts.balance}'),
            const SizedBox(height: 6),
            _PtsMeta(label: 'المحجوز', value: '${pts.reserved}'),
          ],
        ),
        if (tappable) ...[
          const SizedBox(width: 4),
          const Icon(Icons.chevron_left_rounded,
              color: Colors.white70, size: 20),
        ],
      ],
    );
  }
}

class _PtsMeta extends StatelessWidget {
  const _PtsMeta({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(label,
              style: const TextStyle(color: Colors.white60, fontSize: 10.5)),
          Text(value,
              style: const TextStyle(
                  color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
        ],
      );
}
