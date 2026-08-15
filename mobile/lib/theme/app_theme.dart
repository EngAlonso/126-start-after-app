import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Light/dark `ThemeData` pair built on the same Fnashha gold accent used
/// by the web app, with the Cairo font family for Arabic-first content
/// (the web app imports the same family via Google Fonts).
class AppTheme {
  AppTheme._();

  static ThemeData get light => _buildTheme(
        brightness: Brightness.light,
        background: AppColors.lightBackground,
        foreground: AppColors.lightForeground,
        surface: AppColors.lightCard,
        border: AppColors.lightBorder,
        secondary: AppColors.lightSecondary,
        secondaryForeground: AppColors.lightSecondaryForeground,
        muted: AppColors.lightMuted,
        mutedForeground: AppColors.lightMutedForeground,
      );

  static ThemeData get dark => _buildTheme(
        brightness: Brightness.dark,
        background: AppColors.darkBackground,
        foreground: AppColors.darkForeground,
        surface: AppColors.darkCard,
        border: AppColors.darkBorder,
        secondary: AppColors.darkSecondary,
        secondaryForeground: AppColors.darkForeground,
        muted: AppColors.darkMuted,
        mutedForeground: AppColors.darkMutedForeground,
      );

  static ThemeData _buildTheme({
    required Brightness brightness,
    required Color background,
    required Color foreground,
    required Color surface,
    required Color border,
    required Color secondary,
    required Color secondaryForeground,
    required Color muted,
    required Color mutedForeground,
  }) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: AppColors.gold,
      onPrimary: AppColors.lightForeground,
      secondary: secondary,
      onSecondary: secondaryForeground,
      error: AppColors.destructive,
      onError: Colors.white,
      surface: surface,
      onSurface: foreground,
      surfaceContainerHighest: muted,
      onSurfaceVariant: mutedForeground,
      outline: border,
    );

    final baseTextTheme = GoogleFonts.cairoTextTheme(
      brightness == Brightness.dark ? ThemeData.dark().textTheme : ThemeData.light().textTheme,
    ).apply(bodyColor: foreground, displayColor: foreground);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      textTheme: baseTextTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.gold, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: AppColors.lightForeground,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      dividerColor: border,
    );
  }
}
