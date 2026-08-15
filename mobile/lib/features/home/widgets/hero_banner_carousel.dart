import 'dart:async';

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../models/home_demo_data.dart';

/// Large premium promotional banner carousel.
///
/// Swipeable across [demoBanners] with:
/// - Smooth page-snap animation and animated pill dot indicators.
/// - Auto-advance timer (every 4 seconds) that pauses while the user is
///   dragging and resumes when they release — matching the behaviour of
///   Careem/Talabat carousels.
///
/// Placeholder-only: banner art uses gradient + icon (no CDN images in
/// Phase 3A).
class HeroBannerCarousel extends StatefulWidget {
  const HeroBannerCarousel({super.key});

  @override
  State<HeroBannerCarousel> createState() => _HeroBannerCarouselState();
}

class _HeroBannerCarouselState extends State<HeroBannerCarousel> {
  final _controller = PageController(viewportFraction: 1);
  int _page = 0;
  Timer? _autoScrollTimer;
  bool _userDragging = false;

  static const _kAutoScrollInterval = Duration(seconds: 4);
  static const _kAnimDuration = Duration(milliseconds: 600);

  @override
  void initState() {
    super.initState();
    _startAutoScroll();
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = Timer.periodic(_kAutoScrollInterval, (_) {
      if (!mounted || _userDragging || !_controller.hasClients) return;
      final next = (_page + 1) % demoBanners.length;
      _controller.animateToPage(
        next,
        duration: _kAnimDuration,
        curve: Curves.easeInOut,
      );
    });
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Banner pages ──────────────────────────────────────────────
        SizedBox(
          height: 172,
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification is ScrollStartNotification &&
                  notification.dragDetails != null) {
                setState(() => _userDragging = true);
              } else if (notification is ScrollEndNotification) {
                setState(() => _userDragging = false);
              }
              return false;
            },
            child: PageView.builder(
              controller: _controller,
              itemCount: demoBanners.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => _BannerCard(banner: demoBanners[i]),
            ),
          ),
        ),

        // ── Animated pill indicators ──────────────────────────────────
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(demoBanners.length, (i) {
            final isActive = i == _page;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOut,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: isActive ? 22 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: isActive
                    ? AppColors.gold
                    : AppColors.gold.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}

// ─── Banner card ─────────────────────────────────────────────────────────────

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.banner});
  final DemoBanner banner;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          colors: banner.gradient,
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.20),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Large watermark icon bottom-left
          Positioned(
            left: -24,
            bottom: -36,
            child: Icon(
              banner.icon,
              size: 160,
              color: AppColors.gold.withValues(alpha: 0.10),
            ),
          ),

          // Subtle shimmer bar top-right
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 130,
              height: 130,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.06),
              ),
            ),
          ),

          // Content
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // "عرض مميز" badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.3),
                        width: 0.8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(banner.icon, size: 12, color: AppColors.gold),
                      const SizedBox(width: 5),
                      const Text(
                        'عرض مميز',
                        style: TextStyle(
                          color: AppColors.gold,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 11),

                // Title
                Text(
                  banner.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18.5,
                    fontWeight: FontWeight.bold,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 6),

                // Subtitle
                Text(
                  banner.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.72),
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),

                const SizedBox(height: 12),

                // CTA pill — UI only
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'اطلب الآن',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
