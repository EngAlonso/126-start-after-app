/**
 * BannerSlider — shared reusable banner carousel
 *
 * Behaviour:
 *  • Auto-plays every AUTO_PLAY_MS ms
 *  • Pauses the moment the user starts dragging (onScrollBeginDrag)
 *  • Resumes RESUME_DELAY_MS after the user's finger lifts (onMomentumScrollEnd)
 *  • Dot indicators stay in sync with both auto-play and manual swipes
 *  • Snaps one banner at a time; horizontal-only (won't hijack vertical ScrollView)
 *  • Uses scrollToOffset (not scrollToIndex) — avoids the "cannot find item" crash
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

export interface Banner {
  id: number;
  title?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  isActive?: boolean;
}

interface Props {
  banners: Banner[];
  loading?: boolean;
  /** Card height in dp. Default: 168 */
  height?: number;
  /** Extra style applied to the outer container (e.g. marginBottom) */
  style?: ViewStyle;
}

const { width: SW } = Dimensions.get('window');
const SLIDE_W      = SW - 32;          // 16 dp padding each side
const DEFAULT_H    = 168;
const AUTO_PLAY_MS = 3800;
const RESUME_DELAY_MS = 2500;          // wait after drag before resuming

// ─── Fallback when no image ───────────────────────────────────────────────
function GradientPlaceholder({ height }: { height: number }) {
  const colors = useColors();
  return (
    <LinearGradient
      colors={[colors.primary, (colors as any).primaryDark ?? '#C89820']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: SLIDE_W, height }}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────
export function BannerSlider({ banners, loading, height = DEFAULT_H, style }: Props) {
  const colors = useColors();
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef  = useRef<FlatList<Banner>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so interval callbacks always read the current count without stale closure
  const countRef = useRef(0);

  const active = banners.filter(b => b.isActive !== false);

  useEffect(() => {
    countRef.current = active.length;
  }, [active.length]);

  // ── Timer helpers (stable refs → useCallback with no deps) ──────────────
  const clearTimers = useCallback(() => {
    if (timerRef.current  != null) { clearInterval(timerRef.current);  timerRef.current  = null; }
    if (resumeRef.current != null) { clearTimeout(resumeRef.current); resumeRef.current = null; }
  }, []);

  const startAutoPlay = useCallback(() => {
    if (countRef.current <= 1) return;
    clearTimers();
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => {
        const next = (prev + 1) % countRef.current;
        listRef.current?.scrollToOffset({ offset: SLIDE_W * next, animated: true });
        return next;
      });
    }, AUTO_PLAY_MS);
  }, [clearTimers]);

  // Start / restart when banner list changes; cleanup on unmount
  useEffect(() => {
    startAutoPlay();
    return clearTimers;
  }, [active.length, startAutoPlay, clearTimers]);

  // ── Scroll handlers ──────────────────────────────────────────────────────
  const handleScrollBeginDrag = useCallback(() => {
    // User touched the list — stop auto-play immediately
    clearTimers();
  }, [clearTimers]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = e.nativeEvent.contentOffset.x / SLIDE_W;
      const idx = Math.max(0, Math.min(Math.round(raw), countRef.current - 1));
      setActiveIdx(idx);
      // Resume auto-play after a short pause so the user can read the current banner
      resumeRef.current = setTimeout(startAutoPlay, RESUME_DELAY_MS);
    },
    [startAutoPlay],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { height, backgroundColor: colors.muted }, style]} />
    );
  }

  if (active.length === 0) {
    return (
      <View style={[styles.container, { height }, style]}>
        <GradientPlaceholder height={height} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <FlatList
        ref={listRef}
        data={active}
        horizontal
        // pagingEnabled snaps to full SLIDE_W per page — no gaps, no partial peek
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={active.length > 1}
        decelerationRate="fast"
        // Precise item dimensions let scrollToOffset work without layout measuring
        getItemLayout={(_, index) => ({
          length: SLIDE_W,
          offset: SLIDE_W * index,
          index,
        })}
        keyExtractor={item => String(item.id)}
        // ── Swipe gesture hooks ──────────────────────────────────────────
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item }) => {
          const src = item.mobileImageUrl ?? item.imageUrl;
          if (!src) return <GradientPlaceholder height={height} />;
          return (
            <TouchableOpacity activeOpacity={0.92} style={{ width: SLIDE_W, height }}>
              <Image
                source={{ uri: src }}
                style={styles.img}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }}
      />

      {/* Dot indicators — overlaid at the bottom, always in sync */}
      {active.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {active.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                  width: i === activeIdx ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
