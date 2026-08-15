import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface SkeletonCardProps {
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonCard({
  height = 80,
  borderRadius = 14,
  style,
}: SkeletonCardProps) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { height, borderRadius, backgroundColor: colors.muted, opacity },
        style,
      ]}
    />
  );
}

/** Renders N skeleton rows */
export function SkeletonList({ count = 3, height = 80, gap = 12 }: { count?: number; height?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </View>
  );
}

/**
 * A skeleton that mirrors the visual structure of RequestCard.
 * Use this instead of a plain tall rectangle for the requests loading state.
 */
export function RequestCardSkeleton() {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  const Bone = ({ w, h, br = 8 }: { w: number | `${number}%`; h: number; br?: number }) => (
    <Animated.View
      style={{ width: w, height: h, borderRadius: br, backgroundColor: colors.muted, opacity }}
    />
  );

  return (
    <View
      style={[
        skeletonStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header: status chip + id */}
      <View style={skeletonStyles.row}>
        <Bone w={120} h={28} br={20} />
        <Bone w={40} h={20} br={8} />
      </View>
      {/* Service row */}
      <View style={skeletonStyles.row}>
        <Bone w={28} h={28} br={8} />
        <Bone w={'55%'} h={18} br={6} />
      </View>
      {/* Location row */}
      <View style={[skeletonStyles.row, { gap: 6 }]}>
        <Bone w={12} h={12} br={6} />
        <Bone w={'70%'} h={14} br={6} />
      </View>
      {/* Divider */}
      <Bone w={'100%'} h={1} br={1} />
      {/* Footer */}
      <View style={skeletonStyles.row}>
        <Bone w={80} h={18} br={6} />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Bone w={12} h={12} br={6} />
          <Bone w={60} h={14} br={6} />
        </View>
      </View>
    </View>
  );
}

/** Renders N RequestCardSkeleton placeholders */
export function RequestCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <RequestCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    width: '100%',
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
