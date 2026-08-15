import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../theme/app_colors.dart';
import 'intro_provider.dart';
import 'intro_repository.dart' show IntroConfig, IntroImageSource,
    introImagesProvider, introConfigProvider;

/// Two-layer intro slideshow.
///
/// Layer 1 (bottom) — background: URL fetched from GET /api/intro-background.
///   Admin-managed via Admin Panel → CMS → Intro Screens.
///   Never changes, never fades, never moves.
///
/// Layer 2 (top) — characters: transparent PNG images from GET /api/intro-screens.
///   Animate one after another with cross-fade transitions.
///
/// === SHARED INTRO SPEC (mirrors PWA: intro-slideshow-overlay.tsx) ===========
/// TOTAL_DURATION  = 3 000 ms  (always, regardless of image count)
/// Per-image time  : displayMs = round(TOTAL_DURATION / N)
/// Per-image fade  : fadeMs    = clamp(round(displayMs × 0.25), 30, 200)
/// Per-image hold  : holdMs    = displayMs − fadeMs
///
/// Behaviour:
///  • If ≥1 enabled intro image  → show background + animate characters.
///                                 Do NOT show logo splash.
///  • If 0 enabled intro images  → show logo splash, then continue into app.
///  • After the last character, sets [introCompleteProvider] = true.
///  • Both character images and background URL are fetched from the API in
///    parallel; local cache is used for offline resilience.
/// =============================================================================
class IntroScreen extends ConsumerStatefulWidget {
  const IntroScreen({super.key});

  @override
  ConsumerState<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends ConsumerState<IntroScreen> {
  static const int _totalDurationMs = 3000;

  List<IntroImageSource> _images = [];
  String? _bgUrl;                            // background URL from API
  double  _charSizeFraction        = 0.40;  // admin-controlled; 0.40 = 40 % height
  double  _charPositionAlignment   = 0.0;   // -1.0=top  0.0=centre  +1.0=bottom
  int     _currentIndex     = 0;
  bool    _charVisible      = true;          // drives character AnimatedOpacity
  bool    _slideshowStarted = false;

  // ── Timing ──────────────────────────────────────────────────────────────────

  static int _computeDisplayMs(int n) =>
      (_totalDurationMs / n).round();

  static int _computeFadeMs(int n) =>
      (_computeDisplayMs(n) * 0.25).round().clamp(30, 200);

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final imagesAsync = ref.watch(introImagesProvider);
    final configAsync = ref.watch(introConfigProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      body: _buildBody(imagesAsync, configAsync),
    );
  }

  Widget _buildBody(
    AsyncValue<List<IntroImageSource>> imagesAsync,
    AsyncValue<IntroConfig> configAsync,
  ) {
    // While either is still loading: show background if already cached,
    // else show black — never show logo (we don't know yet if images exist).
    if (imagesAsync.isLoading || configAsync.isLoading) {
      final earlyBg = configAsync.asData?.value.bgUrl;
      return _buildBackground(earlyBg);
    }

    // Characters fetch failed → skip intro, show logo splash.
    if (imagesAsync.hasError) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _completeIntro());
      return const _LogoSplash();
    }

    final images = imagesAsync.value!;
    final config = configAsync.asData?.value ?? const IntroConfig();

    if (images.isEmpty) {
      // No character images configured → show logo splash.
      WidgetsBinding.instance.addPostFrameCallback((_) => _completeIntro());
      return const _LogoSplash();
    }

    // Characters exist → show background + start slideshow.
    if (!_slideshowStarted) {
      _images                 = images;
      _bgUrl                  = config.bgUrl;
      _charSizeFraction       = config.characterSizeFraction;
      _charPositionAlignment  = config.characterPositionAlignment;
      _slideshowStarted       = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _runSlideshow());
    }

    return _buildTwoLayers();
  }

  // ── Layer builders ───────────────────────────────────────────────────────────

  /// Layer 1 — fixed background from the API. Never animates.
  Widget _buildBackground(String? url) {
    if (url == null || url.isEmpty) {
      return const SizedBox.expand(child: ColoredBox(color: Colors.black));
    }
    return SizedBox.expand(
      child: Image.network(
        url,
        fit:       BoxFit.cover,
        alignment: Alignment.center,
        frameBuilder: (ctx, child, frame, sync) =>
            (sync || frame != null) ? child : const ColoredBox(color: Colors.black),
        errorBuilder: (_, __, ___) =>
            const ColoredBox(color: Colors.black),
      ),
    );
  }

  /// Stack of Layer 1 (background, static) + Layer 2 (character, animated).
  Widget _buildTwoLayers() {
    final fadeMs = _computeFadeMs(_images.length);
    final src    = _images[_currentIndex];

    return Stack(
      fit: StackFit.expand,
      children: [
        // Layer 1 — always fully visible, never fades.
        _buildBackground(_bgUrl),

        // Layer 2 — character PNG with transparent background, fades in/out.
        AnimatedOpacity(
          opacity:  _charVisible ? 1.0 : 0.0,
          duration: Duration(milliseconds: fadeMs),
          curve:    Curves.easeInOut,
          child:    _buildCharacter(src),
        ),
      ],
    );
  }

  /// Layer 2 image. Transparent PNG → background shows through.
  ///
  /// Size:     charHeight = screenHeight × [_charSizeFraction]  (admin-controlled)
  /// Position: character CENTER is pinned to positionFraction × screenHeight
  ///           using only screen-relative units — no charHeight term in the
  ///           position equation.
  ///
  ///   posFraction = (_charPositionAlignment + 1.0) / 2.0   (maps −1..+1 → 0..1)
  ///   topOffset   = screenH × posFraction − charHeight / 2
  ///   center_y    = topOffset + charHeight / 2 = screenH × posFraction   ✓
  ///
  /// Result: changing [_charSizeFraction] never moves the centre → fully independent.
  Widget _buildCharacter(IntroImageSource src) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenH    = constraints.maxHeight;
        final screenW    = constraints.maxWidth;
        final charHeight = screenH * _charSizeFraction;
        final maxWidth   = screenW * 0.90;

        // Maps _charPositionAlignment (−1..+1) → fraction of screen height (0..1).
        final posFraction = (_charPositionAlignment + 1.0) / 2.0;
        // Top of the character box so that its centre sits at posFraction × screenH.
        final topOffset   = screenH * posFraction - charHeight / 2.0;

        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              left:   0,
              right:  0,
              top:    topOffset,
              height: charHeight,
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: maxWidth),
                  child: src.isAsset
                      ? Image.asset(src.url, fit: BoxFit.contain)
                      : Image.network(
                          src.url,
                          fit: BoxFit.contain,
                          // Show nothing while loading so background stays visible.
                          frameBuilder: (ctx, child, frame, sync) =>
                              (sync || frame != null) ? child : const SizedBox.shrink(),
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  // ── Slideshow logic ──────────────────────────────────────────────────────────

  Future<void> _runSlideshow() async {
    final n         = _images.length;
    final displayMs = _computeDisplayMs(n);
    final fadeMs    = _computeFadeMs(n);
    final holdMs    = displayMs - fadeMs;

    // Character 0 is already visible — hold for holdMs.
    await Future.delayed(Duration(milliseconds: holdMs));

    for (int i = 1; i < n; i++) {
      if (!mounted) return;
      // Fade out character (background stays fully visible).
      setState(() => _charVisible = false);
      await Future.delayed(Duration(milliseconds: fadeMs));
      if (!mounted) return;
      // Swap + fade in next character.
      setState(() {
        _currentIndex = i;
        _charVisible  = true;
      });
      await Future.delayed(Duration(milliseconds: holdMs));
    }

    _completeIntro();
  }

  void _completeIntro() {
    if (!mounted) return;
    ref.read(introCompleteProvider.notifier).complete();
  }
}

// ── Logo splash ───────────────────────────────────────────────────────────────

/// Shown only when no character images are configured.
class _LogoSplash extends ConsumerWidget {
  const _LogoSplash();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cms = ref.watch(cmsBrandingProvider).asData?.value
                ?? CmsSettings.defaults;

    if (cms.splashLogoUrl != null) {
      return Center(
        child: Image.network(
          cms.splashLogoUrl!,
          height: 120,
          fit:    BoxFit.contain,
          errorBuilder: (_, __, ___) => _brandText(cms.appName),
        ),
      );
    }

    return Center(child: _brandText(cms.appName));
  }

  Widget _brandText(String name) => Text(
    name,
    style: const TextStyle(
      fontSize:   40,
      fontWeight: FontWeight.bold,
      color:      AppColors.gold,
    ),
  );
}
