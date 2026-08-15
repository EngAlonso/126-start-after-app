import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { AppLogo } from './AppLogo';

export const TAB_BAR_HEIGHT = 62;
const FAB_SIZE = 66;

type BottomTabBarProps = {
  state: {
    index: number;
    routes: Array<{ key: string }>;
  };
  navigation: {
    navigate: (routeName: string) => void;
    emit: (event: {
      type: string;
      target?: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented?: boolean };
  };
};

type TabDef =
  | { routeName: string; icon: string; isLogo?: false }
  | { routeName: string; isLogo: true; icon?: never }
  | null; // null = FAB slot

/**
 * 5-slot tab bar layout:
 *  [Home/Logo] [Services] [FAB ●] [Requests] [My Page]
 *
 * Route order in Tabs (4 routes):
 *  index(0)  services(1)  requests(2)  my-page(3)
 *
 * Visual slot → route index mapping skips slot 2 (FAB).
 */
const SLOTS: TabDef[] = [
  { routeName: 'index', isLogo: true },
  { routeName: 'services', icon: 'grid' },
  null,
  { routeName: 'requests', icon: 'clipboard' },
  { routeName: 'my-page', icon: 'user' },
];

// visual slot index → route index (skip FAB slot 2)
const visualToRoute = (vi: number) => (vi < 2 ? vi : vi - 1);

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const bottomPad = isWeb ? 34 : insets.bottom;

  const handleFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to services for request creation (prototype behaviour)
    navigation.navigate('services' as never);
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      {/* Background layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        ]}
      />

      {/* Tab row */}
      <View style={styles.row}>
        {SLOTS.map((slot, vi) => {
          if (slot === null) {
            // Center FAB
            return (
              <View key="fab" style={styles.fabSlot}>
                <TouchableOpacity
                  style={[styles.fab, { backgroundColor: colors.primary }]}
                  onPress={handleFab}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={30} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          }

          const ri = visualToRoute(vi);
          const route = state.routes[ri];
          const isFocused = state.index === ri;
          const iconColor = isFocused ? colors.primary : colors.mutedForeground;

          const onPress = () => {
            Haptics.selectionAsync();
            const event = navigation.emit({
              type: 'tabPress',
              target: route?.key ?? '',
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(slot.routeName as never);
            }
          };

          return (
            <TouchableOpacity
              key={slot.routeName}
              style={styles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              {slot.isLogo ? (
                <AppLogo size={28} opacity={isFocused ? 1 : 0.35} />
              ) : (
                <Feather name={slot.icon as any} size={22} color={iconColor} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: TAB_BAR_HEIGHT,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -(FAB_SIZE / 2 - 6),
    shadowColor: '#E9B73A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
});
