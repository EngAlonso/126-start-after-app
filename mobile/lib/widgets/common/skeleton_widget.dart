import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_design.dart';

/// Animated shimmer skeleton — replaces CircularProgressIndicator on any
/// screen that has a predictable layout shape while data is loading.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.borderRadius = AppDesign.radiusSM,
  });

  final double width;
  final double height;
  final double borderRadius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base      = isDark ? AppColors.darkMuted      : const Color(0xFFEEF0F3);
    final highlight = isDark ? AppColors.darkCardBorder  : const Color(0xFFF8F9FA);

    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: Color.lerp(base, highlight, _anim.value),
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}

// ── Composite skeletons ────────────────────────────────────────────────────────

/// Skeleton for a list card (icon + two text lines).
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.height = 88});
  final double height;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      padding: const EdgeInsets.all(AppDesign.spaceMD),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        boxShadow: AppDesign.cardShadow(isDark: isDark),
      ),
      child: Row(
        children: [
          const SkeletonBox(width: 44, height: 44, borderRadius: AppDesign.radiusMD),
          const SizedBox(width: AppDesign.spaceMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                SkeletonBox(height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 120, height: 11),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// N skeleton cards stacked vertically.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 4, this.cardHeight = 88});
  final int count;
  final double cardHeight;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(count, (i) => Padding(
        padding: EdgeInsets.only(bottom: i < count - 1 ? AppDesign.spaceSM : 0),
        child: SkeletonCard(height: cardHeight),
      )),
    );
  }
}

/// Skeleton for a banner/image carousel slot.
class SkeletonBanner extends StatelessWidget {
  const SkeletonBanner({super.key, this.height = 160});
  final double height;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(
      height: height,
      borderRadius: AppDesign.radiusLG,
    );
  }
}

/// Skeleton for a service grid item.
class SkeletonServiceItem extends StatelessWidget {
  const SkeletonServiceItem({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(AppDesign.spaceMD),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        boxShadow: AppDesign.cardShadow(isDark: isDark),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          SkeletonBox(width: 44, height: 44, borderRadius: AppDesign.radiusMD),
          SizedBox(height: 10),
          SkeletonBox(height: 12),
          SizedBox(height: 6),
          SkeletonBox(width: 56, height: 10),
        ],
      ),
    );
  }
}

/// A 2-column grid of [count] skeleton service items.
class SkeletonServiceGrid extends StatelessWidget {
  const SkeletonServiceGrid({super.key, this.count = 6});
  final int count;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: AppDesign.spaceXS,
        mainAxisSpacing: AppDesign.spaceXS,
        childAspectRatio: 0.9,
      ),
      itemCount: count,
      itemBuilder: (_, __) => const SkeletonServiceItem(),
    );
  }
}
