import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/env.dart';

const _kCharCacheKey  = 'intro_screen_urls_v1';
const _kBgCacheKey    = 'intro_background_url_v1';
const _kSizeCacheKey  = 'intro_character_size_v1';
const _kPosCacheKey   = 'intro_character_pos_v1';
const _kDefaultSize   = 40; // % of screen height
const _kDefaultPos    = 50; // 0=top 50=center 100=bottom

/// Fetches intro screen character image URLs and background URL from the API.
/// Falls back to local cache on network failure.
class IntroRepository {

  // ── Character images ────────────────────────────────────────────────────────

  Future<List<IntroImageSource>> getIntroImages() async {
    try {
      final apiImages = await _fetchCharactersFromApi();
      if (apiImages.isNotEmpty) {
        await _cacheChars(apiImages.map((e) => e.url).toList());
        return apiImages;
      }
    } catch (_) {
      // Network error — fall through to cache.
    }

    final cached = await _loadCharCache();
    if (cached.isNotEmpty) {
      return cached.map((url) => IntroImageSource.network(url)).toList();
    }

    return [];
  }

  Future<List<IntroImageSource>> _fetchCharactersFromApi() async {
    final url  = Uri.parse('${Env.apiBaseUrl}/intro-screens');
    final resp = await http.get(url).timeout(const Duration(seconds: 10));
    if (resp.statusCode != 200) return [];

    final List<dynamic> data = jsonDecode(resp.body) as List<dynamic>;
    return data
        .whereType<Map<String, dynamic>>()
        .where((m) => m['enabled'] == true)
        .map((m) => IntroImageSource.network(
              (m['imageUrl'] ?? m['image_url']) as String))
        .toList();
  }

  Future<void> _cacheChars(List<String> urls) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kCharCacheKey, jsonEncode(urls));
  }

  Future<List<String>> _loadCharCache() async {
    final prefs = await SharedPreferences.getInstance();
    final raw   = prefs.getString(_kCharCacheKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List<dynamic>).cast<String>();
    } catch (_) {
      return [];
    }
  }

  // ── Intro config (background URL + character size) ──────────────────────────

  /// Fetches background URL and character size from the API.
  /// Falls back to local cache for each field on network failure.
  Future<IntroConfig> getIntroConfig() async {
    try {
      final url  = Uri.parse('${Env.apiBaseUrl}/intro-background');
      final resp = await http.get(url).timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;

        final bgUrl = data['backgroundUrl'] as String?;
        if (bgUrl != null && bgUrl.isNotEmpty) {
          await _cacheBg(bgUrl);
        } else {
          await _clearBgCache();
        }

        final sizeRaw = data['characterSize'];
        final size = (sizeRaw is int)
            ? sizeRaw.clamp(10, 100)
            : (sizeRaw is double)
                ? sizeRaw.toInt().clamp(10, 100)
                : _kDefaultSize;
        await _cacheSize(size);

        final posRaw = data['characterPosition'];
        final position = (posRaw is int)
            ? posRaw.clamp(0, 100)
            : (posRaw is double)
                ? posRaw.toInt().clamp(0, 100)
                : _kDefaultPos;
        await _cachePos(position);

        return IntroConfig(
          bgUrl:             (bgUrl?.isNotEmpty ?? false) ? bgUrl : null,
          characterSize:     size,
          characterPosition: position,
        );
      }
    } catch (_) {
      // Network error — fall through to cache.
    }

    // Use cached values for all fields.
    final cachedBg  = await _loadBgCache();
    final cachedSize = await _loadSizeCache();
    final cachedPos  = await _loadPosCache();
    return IntroConfig(bgUrl: cachedBg, characterSize: cachedSize, characterPosition: cachedPos);
  }

  Future<void> _cacheBg(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kBgCacheKey, url);
  }

  Future<void> _clearBgCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kBgCacheKey);
  }

  Future<String?> _loadBgCache() async {
    final prefs = await SharedPreferences.getInstance();
    final raw   = prefs.getString(_kBgCacheKey);
    return (raw?.isNotEmpty ?? false) ? raw : null;
  }

  Future<void> _cacheSize(int size) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kSizeCacheKey, size);
  }

  Future<int> _loadSizeCache() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_kSizeCacheKey) ?? _kDefaultSize;
  }

  Future<void> _cachePos(int pos) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kPosCacheKey, pos);
  }

  Future<int> _loadPosCache() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_kPosCacheKey) ?? _kDefaultPos;
  }
}

// ── Intro config ──────────────────────────────────────────────────────────────

/// Background URL + admin-controlled character size and vertical position.
class IntroConfig {
  final String? bgUrl;

  /// Character height as a percentage of screen height (10–100). Default: 40.
  final int characterSize;

  /// Vertical position 0–100 (0 = top, 50 = centre, 100 = bottom). Default: 50.
  final int characterPosition;

  const IntroConfig({
    this.bgUrl,
    this.characterSize     = 40,
    this.characterPosition = 50,
  });

  /// Height fraction for ConstrainedBox (0.1–1.0).
  double get characterSizeFraction => characterSize / 100.0;

  /// Maps 0–100 → -1.0–+1.0 for Flutter's Alignment.y.
  /// -1.0 = top, 0.0 = centre, +1.0 = bottom.
  double get characterPositionAlignment => (characterPosition / 50.0) - 1.0;
}

// ── Discriminated union ────────────────────────────────────────────────────────

/// A single intro image — network URL or bundled asset.
class IntroImageSource {
  final bool   isAsset;
  final String url;

  const IntroImageSource._({required this.isAsset, required this.url});

  factory IntroImageSource.network(String url) =>
      IntroImageSource._(isAsset: false, url: url);

  factory IntroImageSource.asset(String path) =>
      IntroImageSource._(isAsset: true, url: path);
}

// ── Riverpod providers ─────────────────────────────────────────────────────────

final introRepositoryProvider = Provider<IntroRepository>((ref) {
  return IntroRepository();
});

/// Character images — transparent PNGs from the intro-screens API.
final introImagesProvider = FutureProvider<List<IntroImageSource>>((ref) async {
  return ref.read(introRepositoryProvider).getIntroImages();
});

/// Combined intro config — background URL + admin-controlled character size.
/// Both values are fetched from a single API call and cached individually.
final introConfigProvider = FutureProvider<IntroConfig>((ref) async {
  return ref.read(introRepositoryProvider).getIntroConfig();
});
