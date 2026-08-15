import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Unified design token system — every screen draws from these constants
/// so the whole app feels like one product.
class AppDesign {
  AppDesign._();

  // ── Border radius ──────────────────────────────────────────────────────
  static const double radiusXS   =  8.0;
  static const double radiusSM   = 12.0;
  static const double radiusMD   = 16.0;
  static const double radiusLG   = 20.0;
  static const double radiusXL   = 24.0;
  static const double radiusXXL  = 32.0;
  static const double radiusFull = 999.0;

  // ── Spacing ────────────────────────────────────────────────────────────
  static const double spaceXXS =  4.0;
  static const double spaceXS  =  8.0;
  static const double spaceSM  = 12.0;
  static const double spaceMD  = 16.0;
  static const double spaceLG  = 24.0;
  static const double spaceXL  = 32.0;
  static const double spaceXXL = 48.0;

  // ── Card shadows ───────────────────────────────────────────────────────
  static List<BoxShadow> cardShadow({bool isDark = false}) => [
    BoxShadow(
      color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.06),
      blurRadius: 18,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: isDark ? 0.10 : 0.03),
      blurRadius: 4,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> goldShadow({double opacity = 0.28}) => [
    BoxShadow(
      color: AppColors.gold.withValues(alpha: opacity),
      blurRadius: 24,
      spreadRadius: 0,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> bottomNavShadow({bool isDark = false}) => [
    BoxShadow(
      color: Colors.black.withValues(alpha: isDark ? 0.32 : 0.08),
      blurRadius: 28,
      offset: const Offset(0, -6),
    ),
  ];

  // ── Durations ──────────────────────────────────────────────────────────
  static const Duration durationFast   = Duration(milliseconds: 180);
  static const Duration durationNormal = Duration(milliseconds: 280);
  static const Duration durationSlow   = Duration(milliseconds: 420);

  // ── Page transition ────────────────────────────────────────────────────
  static Widget fadeSlideTransition(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final offset = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));

    return FadeTransition(
      opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
      child: SlideTransition(position: offset, child: child),
    );
  }
}
