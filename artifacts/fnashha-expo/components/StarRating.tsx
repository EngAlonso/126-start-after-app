import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface StarRatingProps {
  /** Rating value (0–max). Non-integers are rounded to the nearest whole star. */
  value: number;
  /** Total number of stars. Default: 5 */
  max?: number;
  /** Star icon size in px. Default: 16 */
  size?: number;
  /** Gap between stars in px. Default: 2 */
  gap?: number;
  /**
   * When true, each star is a TouchableOpacity.
   * Tapping star N calls onChange(N) where N is 1-based.
   */
  interactive?: boolean;
  /** Called with the new 1-based rating when a star is tapped (requires interactive). */
  onChange?: (value: number) => void;
}

/**
 * Unified gold star rating component used across the entire Fnashha Expo app.
 *
 * Visual style (reference: technician-profile screen):
 *   - FontAwesome `star` (filled, #F59E0B gold) / `star-o` (empty, colors.border)
 *   - Empty stars adapt to light/dark theme via colors.border
 *
 * Read-only by default. Pass `interactive` + `onChange` for the rating dialog.
 *
 * Usage:
 *   <StarRating value={4.3} size={14} />                        // read-only
 *   <StarRating value={stars} size={38} gap={8} interactive onChange={setStars} />
 */
export function StarRating({
  value,
  max = 5,
  size = 16,
  gap = 2,
  interactive = false,
  onChange,
}: StarRatingProps) {
  const colors = useColors();
  const filled = Math.round(value);

  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: max }).map((_, i) => {
        const isFilled = i < filled;
        const icon = (
          <FontAwesome
            name={isFilled ? 'star' : 'star-o'}
            size={size}
            color={isFilled ? '#F59E0B' : colors.border}
          />
        );
        if (interactive) {
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onChange?.(i + 1)}
              activeOpacity={0.7}
            >
              {icon}
            </TouchableOpacity>
          );
        }
        return <View key={i}>{icon}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
