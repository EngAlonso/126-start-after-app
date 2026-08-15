/**
 * Header for inner (stack-pushed) screens.
 * Shows a back arrow on the left (visual right in RTL) and a title.
 *
 * Back priority:
 *  1. onBack prop (custom override)
 *  2. router.back() when there is a previous screen in the stack
 *  3. Role-based home fallback for deep-link / notification entry points
 *     (customer → /(customer)/, technician → /(technician)/, guest → /)
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, rightElement }: ScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 12 : insets.top;
  const { user } = useAuth();
  const { isRTL, direction } = useLocale();

  const handleBack = () => {
    // 1. Custom override
    if (onBack) { onBack(); return; }
    // 2. Normal stack navigation
    if (router.canGoBack()) { router.back(); return; }
    // 3. Fallback for screens entered via deep link / notification
    const home =
      user?.role === 'technician' ? '/(technician)/' :
      user?.role === 'customer'   ? '/(customer)/'   :
      '/';
    router.replace(home as any);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPad + 10, backgroundColor: colors.card, direction },
        { borderBottomColor: colors.border },
      ]}
    >
      {/* Right slot (back arrow) — in RTL this appears on visual right = logical start */}
      <TouchableOpacity style={styles.iconBtn} onPress={handleBack} activeOpacity={0.7}>
        <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={22} color={colors.foreground} />
      </TouchableOpacity>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>

      {/* Left slot */}
      <View style={styles.iconBtn}>{rightElement ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
});
