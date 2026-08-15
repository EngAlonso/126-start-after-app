import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the user's theme-mode preference so dark/light mode survives
/// app restarts. The default is [ThemeMode.system] (follows device setting).
final themeModeProvider =
    AsyncNotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);

class ThemeModeNotifier extends AsyncNotifier<ThemeMode> {
  static const _key = 'fnashha_theme_mode_v1';

  @override
  Future<ThemeMode> build() async {
    final prefs = await SharedPreferences.getInstance();
    return switch (prefs.getString(_key)) {
      'light'  => ThemeMode.light,
      'dark'   => ThemeMode.dark,
      _        => ThemeMode.system,
    };
  }

  Future<void> setMode(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, switch (mode) {
      ThemeMode.light  => 'light',
      ThemeMode.dark   => 'dark',
      ThemeMode.system => 'system',
    });
    state = AsyncValue.data(mode);
  }

  /// Toggles between dark and light. If currently system, switches to dark.
  void toggle() {
    final current = state.asData?.value ?? ThemeMode.system;
    setMode(current == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }

  bool get isDark {
    final v = state.asData?.value ?? ThemeMode.system;
    return v == ThemeMode.dark;
  }
}
