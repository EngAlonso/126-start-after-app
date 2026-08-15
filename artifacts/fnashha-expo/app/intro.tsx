/**
 * Intro Screen — Two-layer animated splash
 * Issue #9: Fix black area at bottom — use SafeAreaView properly and
 *            cover the full screen including unsafe areas.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '@/hooks/useApi';
import { resolveMediaUrl } from '@/hooks/api-base';
import { markIntroPlayedThisSession } from '@/constants/intro';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

// Use screen dimensions (includes status bar / nav bar areas) for full coverage
const { width: SW, height: SH } = Dimensions.get('screen');
const TOTAL_DURATION_MS  = 3_000;
const PULSE_DURATION_MS  = 900;
const OVERLAP_MS_DEFAULT = 250;
const ENTER_SCALE_FROM   = 0.97;
const EXIT_SCALE_TO      = 0.97;
const PULSE_SCALE_MAX    = 1.03;
const FRAME_MS = 16;

interface IntroScreenData {
  id: number;
  imageUrl: string;
  displayOrder: number;
  enabled: boolean;
}

interface IntroBackground {
  backgroundUrl: string | null;
  characterSize: number;
  characterPosition: number;
}

function computeTiming(n: number) {
  const displayMs = Math.round(TOTAL_DURATION_MS / Math.max(n, 1));
  const fadeMs    = Math.min(Math.max(Math.round(displayMs * 0.25), 30), 200);
  return { displayMs, fadeMs, holdMs: displayMs - fadeMs };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function animParallel(anims: Animated.CompositeAnimation[]): Promise<void> {
  return new Promise(resolve =>
    Animated.parallel(anims).start(({ finished }) => { if (finished) resolve(); }),
  );
}

export default function IntroScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const aOpacity    = useRef(new Animated.Value(0)).current;
  const aEntryScale = useRef(new Animated.Value(ENTER_SCALE_FROM)).current;
  const aPulseScale = useRef(new Animated.Value(1.0)).current;

  const bOpacity    = useRef(new Animated.Value(0)).current;
  const bEntryScale = useRef(new Animated.Value(ENTER_SCALE_FROM)).current;
  const bPulseScale = useRef(new Animated.Value(1.0)).current;

  const [aUrl, setAUrl] = useState<string | null>(null);
  const [bUrl, setBUrl] = useState<string | null>(null);

  const activePulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const [bgData, setBgData]   = useState<IntroBackground | null>(null);
  const [backgroundImageFailed, setBackgroundImageFailed] = useState(false);
  const [screens, setScreens] = useState<IntroScreenData[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<
    Record<number, 'pending' | 'loaded' | 'error'>
  >({});
  const [preloadComplete, setPreloadComplete] = useState(false);

  const finish = useCallback((_sc: IntroScreenData[]) => {
    activePulseRef.current?.stop();
    markIntroPlayedThisSession();
    router.replace('/');
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<IntroBackground>('/api/intro-background').catch(() => null),
      apiFetch<IntroScreenData[]>('/api/intro-screens').catch(() => []),
    ]).then(([bg, sc]) => {
      if (cancelled) return;
      setBgData(bg);
      setBackgroundImageFailed(false);
      const normalized = (Array.isArray(sc) ? sc : []).flatMap((screen) => {
        const imageUrl = resolveMediaUrl(screen.imageUrl);
        if (!imageUrl) {
          console.error(`[Intro] Missing image URL for screen ${screen.id}`);
          return [];
        }
        return [{ ...screen, imageUrl }];
      });
      const sorted = normalized.sort((a, b) => a.displayOrder - b.displayOrder);
      setScreens(sorted);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    setPreloadComplete(false);
    setPreloadStatus(
      Object.fromEntries(screens.map((screen) => [screen.id, 'pending'])),
    );
  }, [loaded, screens]);

  useEffect(() => {
    if (!loaded || screens.length === 0) return;

    const statuses = screens.map((screen) => preloadStatus[screen.id]);
    if (statuses.some((status) => !status || status === 'pending')) return;

    const failedScreens = screens.filter(
      (screen) => preloadStatus[screen.id] === 'error',
    );
    if (failedScreens.length > 0) {
      console.error(
        `[Intro] ${failedScreens.length} intro image(s) failed to load; ` +
        'skipping only those slides.',
        failedScreens.map((screen) => ({ id: screen.id, url: screen.imageUrl })),
      );
    }

    setPreloadComplete(true);
  }, [loaded, preloadStatus, screens]);

  const handlePreloadLoaded = useCallback((id: number) => {
    setPreloadStatus((current) => {
      if (current[id] === 'loaded') return current;
      return { ...current, [id]: 'loaded' };
    });
  }, []);

  const handlePreloadError = useCallback((screen: IntroScreenData) => {
    console.error(`[Intro] Failed to preload image ${screen.id}: ${screen.imageUrl}`);
    setPreloadStatus((current) => {
      if (current[screen.id] === 'error') return current;
      return { ...current, [screen.id]: 'error' };
    });
  }, []);

  const handleVisibleImageError = useCallback((slot: 'A' | 'B', url: string) => {
    // The hidden preloaders should make this unreachable in normal operation.
    // Remove a failed visible slot so the slideshow can continue instead of
    // leaving a broken native image view on screen.
    console.error(`[Intro] Failed to render preloaded image: ${url}`);
    if (slot === 'A') {
      setAUrl((current) => (current === url ? null : current));
    } else {
      setBUrl((current) => (current === url ? null : current));
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (screens.length === 0) { finish([]); return; }
    if (!preloadComplete) return;

    let cancelled = false;
    const playableScreens = screens.filter(
      (screen) => preloadStatus[screen.id] === 'loaded',
    );
    if (playableScreens.length === 0) {
      console.error('[Intro] No intro images finished loading.');
      finish(screens);
      return;
    }

    const n = playableScreens.length;
    const { fadeMs, holdMs } = computeTiming(n);
    const overlapMs = Math.min(OVERLAP_MS_DEFAULT, Math.floor(fadeMs * 0.8));

    function makePulseLoop(pulseVal: Animated.Value): Animated.CompositeAnimation {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(pulseVal, { toValue: PULSE_SCALE_MAX, duration: PULSE_DURATION_MS / 2, useNativeDriver: true }),
          Animated.timing(pulseVal, { toValue: 1.0,             duration: PULSE_DURATION_MS / 2, useNativeDriver: true }),
        ]),
      );
    }

    function startPulse(pulseVal: Animated.Value) {
      activePulseRef.current?.stop();
      pulseVal.setValue(1.0);
      const loop = makePulseLoop(pulseVal);
      activePulseRef.current = loop;
      loop.start();
    }

    function stopCurrentPulse(pulseValToReset: Animated.Value) {
      activePulseRef.current?.stop();
      activePulseRef.current = null;
      pulseValToReset.setValue(1.0);
    }

    aOpacity.setValue(0);    aEntryScale.setValue(ENTER_SCALE_FROM); aPulseScale.setValue(1.0);
    bOpacity.setValue(0);    bEntryScale.setValue(ENTER_SCALE_FROM); bPulseScale.setValue(1.0);
    setAUrl(null); setBUrl(null);

    async function run() {
      if (cancelled) return;

      setAUrl(playableScreens[0].imageUrl);
      await nextFrame();
      if (cancelled) return;

      await animParallel([
        Animated.timing(aOpacity,    { toValue: 1.0, duration: fadeMs, useNativeDriver: true }),
        Animated.timing(aEntryScale, { toValue: 1.0, duration: fadeMs, useNativeDriver: true }),
      ]);
      if (cancelled) return;

      startPulse(aPulseScale);

      let current: 'A' | 'B' = 'A';

      for (let i = 1; i < n; i++) {
        if (cancelled) return;

        await delay(holdMs - overlapMs);
        if (cancelled) return;

        const nextSlot: 'A' | 'B' = current === 'A' ? 'B' : 'A';
        const currO     = current   === 'A' ? aOpacity    : bOpacity;
        const currS     = current   === 'A' ? aEntryScale : bEntryScale;
        const currPulse = current   === 'A' ? aPulseScale : bPulseScale;
        const nextO     = nextSlot  === 'A' ? aOpacity    : bOpacity;
        const nextS     = nextSlot  === 'A' ? aEntryScale : bEntryScale;

        stopCurrentPulse(currPulse);
        if (nextSlot === 'A') {
          aOpacity.setValue(0); aEntryScale.setValue(ENTER_SCALE_FROM); aPulseScale.setValue(1.0);
          setAUrl(playableScreens[i].imageUrl);
        } else {
          bOpacity.setValue(0); bEntryScale.setValue(ENTER_SCALE_FROM); bPulseScale.setValue(1.0);
          setBUrl(playableScreens[i].imageUrl);
        }

        await nextFrame();
        if (cancelled) return;

        Animated.parallel([
          Animated.timing(currO, { toValue: 0,             duration: fadeMs + overlapMs, useNativeDriver: true }),
          Animated.timing(currS, { toValue: EXIT_SCALE_TO, duration: fadeMs + overlapMs, useNativeDriver: true }),
          Animated.timing(nextO, { toValue: 1.0,           duration: fadeMs + overlapMs, useNativeDriver: true }),
          Animated.timing(nextS, { toValue: 1.0,           duration: fadeMs + overlapMs, useNativeDriver: true }),
        ]).start();

        await delay(fadeMs + overlapMs);
        if (cancelled) return;

        startPulse(nextSlot === 'A' ? aPulseScale : bPulseScale);
        current = nextSlot;
      }

      const tailMs = Math.max(0, holdMs - n * FRAME_MS);
      await delay(tailMs);
      if (cancelled) return;

      activePulseRef.current?.stop();
      finish(playableScreens);
    }

    run();

    return () => {
      cancelled = true;
      activePulseRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, loaded, preloadComplete, preloadStatus, screens]);

  if (!loaded) return null;

  const charSize = bgData?.characterSize  ?? 40;
  const charPos  = bgData?.characterPosition ?? 50;
  const charH    = (SH * charSize) / 100;
  const charTop  = (SH * charPos) / 100 - charH / 2;

  return (
    // edges={[]} — we handle our own safe area with absolute positioning
    // so the container fills the entire screen including unsafe zones
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Preload every CMS image through React Native's native image loader.
          The slideshow does not start until each image reports onLoad or
          onError, so no transition can race an image download or decode. */}
      {screens.map((screen) => (
        <Image
          key={`preload-${screen.id}`}
          source={{ uri: screen.imageUrl }}
          style={styles.preloader}
          onLoad={() => handlePreloadLoaded(screen.id)}
          onError={() => handlePreloadError(screen)}
        />
      ))}

      {/* ── Layer 1: Background (static, full-screen, covers ALL unsafe areas) ── */}
      {bgData?.backgroundUrl && !backgroundImageFailed ? (
        <Image
          source={{ uri: bgData.backgroundUrl }}
          style={styles.background}
          resizeMode="cover"
          onError={() => {
            console.error(
              `[Intro] Failed to render intro background: ${bgData.backgroundUrl}`,
            );
            setBackgroundImageFailed(true);
          }}
        />
      ) : (
        <View style={[styles.background, styles.bgFallback]} />
      )}

      {/* ── Layer 2: Character slots ─────────────────────────────────────── */}
      {bUrl ? (
        <Animated.Image
          source={{ uri: bUrl }}
          style={[
            styles.character,
            {
              height:    charH,
              top:       charTop,
              opacity:   bOpacity,
              transform: [{ scale: Animated.multiply(bEntryScale, bPulseScale) }],
            },
          ]}
          resizeMode="contain"
            onError={() => handleVisibleImageError('B', bUrl)}
        />
      ) : null}

      {aUrl ? (
        <Animated.Image
          source={{ uri: aUrl }}
          style={[
            styles.character,
            {
              height:    charH,
              top:       charTop,
              opacity:   aOpacity,
              transform: [{ scale: Animated.multiply(aEntryScale, aPulseScale) }],
            },
          ]}
          resizeMode="contain"
            onError={() => handleVisibleImageError('A', aUrl)}
        />
      ) : null}

      {/* ── Skip button — inside SafeAreaView so it stays in safe zone ──── */}
      <SafeAreaView style={styles.safeOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => finish(screens)}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>{t.intro.skip}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen container — uses position absolute to ensure it covers
  // the entire screen including bottom home indicator and status bar.
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgFallback: {
    backgroundColor: '#1a1a2e',
  },
  character: {
    position: 'absolute',
    left:     0,
    right:    0,
    maxWidth: SW,
  },
  preloader: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  // SafeAreaView overlay for the skip button
  safeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  skipBtn: {
    position:          'absolute',
    top:               Platform.OS === 'web' ? 20 : 12,
    right:             20,
    backgroundColor:   'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.25)',
  },
  skipText: {
    color:      '#fff',
    fontSize:   14,
    fontFamily: 'Cairo_500Medium',
  },
});
