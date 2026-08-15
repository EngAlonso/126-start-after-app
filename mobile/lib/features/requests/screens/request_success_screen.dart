import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';

/// Celebration screen shown after a successful `POST /api/requests`.
/// Uses a two-phase animation: the gold check badge scales in (0 → 1) and
/// the body text fades + slides up. No lottie dependency needed.
class RequestSuccessScreen extends StatefulWidget {
  const RequestSuccessScreen({super.key, required this.requestId});

  final int requestId;

  @override
  State<RequestSuccessScreen> createState() => _RequestSuccessScreenState();
}

class _RequestSuccessScreenState extends State<RequestSuccessScreen>
    with TickerProviderStateMixin {
  late final AnimationController _badgeCtrl;
  late final AnimationController _bodyCtrl;

  late final Animation<double> _badgeScale;
  late final Animation<double> _badgeFade;
  late final Animation<double> _bodyFade;
  late final Animation<Offset> _bodySlide;

  @override
  void initState() {
    super.initState();

    _badgeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _bodyCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _badgeScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _badgeCtrl, curve: Curves.elasticOut),
    );
    _badgeFade = CurvedAnimation(parent: _badgeCtrl, curve: Curves.easeIn);

    _bodyFade = CurvedAnimation(parent: _bodyCtrl, curve: Curves.easeIn);
    _bodySlide = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _bodyCtrl, curve: Curves.easeOut));

    _badgeCtrl.forward().whenComplete(
          () => Future.delayed(const Duration(milliseconds: 150), _bodyCtrl.forward),
        );
  }

  @override
  void dispose() {
    _badgeCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),

              // ── Badge ──────────────────────────────────────────────────
              Center(
                child: FadeTransition(
                  opacity: _badgeFade,
                  child: ScaleTransition(
                    scale: _badgeScale,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFD700), Color(0xFFE8B800)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.gold.withValues(alpha: 0.4),
                            blurRadius: 32,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.check_rounded,
                        color: Colors.white,
                        size: 56,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // ── Body text ──────────────────────────────────────────────
              SlideTransition(
                position: _bodySlide,
                child: FadeTransition(
                  opacity: _bodyFade,
                  child: Column(
                    children: [
                      const Text(
                        'تم إرسال طلبك!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'سيتواصل معك الفنيون المتاحون في منطقتك خلال فترة قصيرة.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          height: 1.55,
                          color:
                              Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Request ID chip
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark
                              ? AppColors.darkCard
                              : AppColors.lightCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isDark
                                ? AppColors.darkCardBorder
                                : AppColors.lightCardBorder,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.receipt_long_rounded,
                                size: 18, color: AppColors.gold),
                            const SizedBox(width: 8),
                            Text(
                              'رقم الطلب: #${widget.requestId}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const Spacer(),

              // ── CTA ────────────────────────────────────────────────────
              FadeTransition(
                opacity: _bodyFade,
                child: ElevatedButton(
                  onPressed: () => context.go(RoutePaths.customerHome),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: const Text(
                    'العودة للرئيسية',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
