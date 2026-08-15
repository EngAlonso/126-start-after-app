import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/env.dart';
import 'cms_settings.dart';

const _kCacheKey = 'cms_settings_v1';

/// Fetches and caches CMS branding settings from GET /api/cms/settings.
///
/// Strategy: network-first, SharedPreferences cache fallback.
/// Mirrors the pattern used by IntroRepository for offline resilience.
class CmsRepository {
  Future<CmsSettings> getCmsSettings() async {
    try {
      final url  = Uri.parse('${Env.apiBaseUrl}/cms/settings');
      final resp = await http.get(url).timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final map = jsonDecode(resp.body) as Map<String, dynamic>;
        await _cache(map);
        return CmsSettings.fromMap(map);
      }
    } catch (_) {
      // Network error — fall through to cache.
    }
    return _fromCache();
  }

  Future<void> _cache(Map<String, dynamic> map) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCacheKey, jsonEncode(map));
    } catch (_) {}
  }

  Future<CmsSettings> _fromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw   = prefs.getString(_kCacheKey);
      if (raw != null) {
        final map = jsonDecode(raw) as Map<String, dynamic>;
        return CmsSettings.fromMap(map);
      }
    } catch (_) {}
    return CmsSettings.defaults;
  }
}

final cmsRepositoryProvider = Provider<CmsRepository>((_) => CmsRepository());
