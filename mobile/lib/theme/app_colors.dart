import 'package:flutter/material.dart';

/// Colors extracted directly from the web app's design tokens
/// (`artifacts/fnashha/src/index.css` `:root` / `.dark` blocks) so the
/// Flutter app and the web/PWA app share one brand identity. Keep these in
/// sync if the web theme changes — there is no shared token source between
/// the two codebases yet.
class AppColors {
  AppColors._();

  // ── Brand ────────────────────────────────────────────────────────────
  static const gold = Color(0xFFF5C518); // --primary / --ring / --chart-1

  // ── Light mode ───────────────────────────────────────────────────────
  static const lightBackground = Color(0xFFF9FAFB);
  static const lightForeground = Color(0xFF1A1A1A);
  static const lightCard = Color(0xFFFFFFFF);
  static const lightCardBorder = Color(0xFFE8EBEE);
  static const lightSidebar = Color(0xFFFBF2DA);
  static const lightSidebarBorder = Color(0xFFEDDDB6);
  static const lightSecondary = Color(0xFFF9F4E7);
  static const lightSecondaryForeground = Color(0xFF404040);
  static const lightMuted = Color(0xFFF0F2F4);
  static const lightMutedForeground = Color(0xFF737373);
  static const lightAccent = Color(0xFFF7EDD4);
  static const lightBorder = Color(0xFFE2E6E9);
  static const lightInput = Color(0xFFD3D9DE);

  // ── Dark mode ────────────────────────────────────────────────────────
  static const darkBackground = Color(0xFF101318);
  static const darkForeground = Color(0xFFEDE9DE);
  static const darkCard = Color(0xFF181C25);
  static const darkCardBorder = Color(0xFF292F3D);
  static const darkSidebar = Color(0xFF14171F);
  static const darkSecondary = Color(0xFF1F232E);
  static const darkMuted = Color(0xFF1F232E);
  static const darkMutedForeground = Color(0xFF949FB8);
  static const darkAccent = Color(0xFF292F3D);
  static const darkBorder = Color(0xFF292F3D);
  static const darkInput = Color(0xFF333B4D);

  // ── Shared across modes ──────────────────────────────────────────────
  static const destructive = Color(0xFFDC2828);
  static const chartBlue = Color(0xFF3CA7DD);
  static const chartGreen = Color(0xFF22C35D);
  static const chartPurple = Color(0xFFAF57DB);
}
