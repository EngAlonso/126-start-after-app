import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Flips to `true` once [IntroScreen] has cycled through every image at least
/// once. The GoRouter redirect in [app_router.dart] watches this provider so
/// the app never navigates away from the splash route before the intro has
/// finished — even if auth resolves quickly.
///
/// === SHARED INTRO SPEC (mirrors PWA: artifacts/fnashha/src/components/intro-slideshow-overlay.tsx) ===
/// TOTAL_DURATION  = 3 000 ms
/// Per-image time  : displayMs = round(TOTAL_DURATION / N)
/// Per-image fade  : fadeMs    = clamp(round(displayMs × 0.25), 30, 200)
/// Per-image hold  : holdMs    = displayMs − fadeMs
/// Behaviour: show every enabled image exactly once, then complete.
/// ============================================================================
class IntroCompleteNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  /// Called by [IntroScreen] after all images have been shown.
  void complete() => state = true;
}

final introCompleteProvider = NotifierProvider<IntroCompleteNotifier, bool>(
  IntroCompleteNotifier.new,
);
