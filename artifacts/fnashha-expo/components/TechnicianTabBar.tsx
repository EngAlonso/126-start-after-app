/**
 * 4-slot technician tab bar (no FAB):
 *  [Home/Logo] [My Page] [Requests] [My Account]
 *
 * Standalone component: uses usePathname() for active-state detection and
 * router.navigate() for navigation. No longer depends on BottomTabBarProps,
 * so it can be rendered from any level of the component tree (including the
 * root layout, outside the Tabs navigator).
 */
import React from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import * as Haptics from 'expo-haptics';
import { AppLogo } from '@/components/AppLogo';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

export const TECH_TAB_BAR_HEIGHT = 64;

/** Map pathname → active routeName (empty string = no tab active). */
function getActiveTab(pathname: string): string {
  if (
    pathname === '/(technician)' ||
    pathname === '/(technician)/index' ||
    pathname === '/'
  ) return 'index';

  if (pathname.startsWith('/(technician)/my-page') || pathname === '/my-page') return 'my-page';
  if (pathname.startsWith('/(technician)/requests') || pathname === '/requests') return 'requests';
  if (pathname.startsWith('/(technician)/account') || pathname === '/account') return 'account';

  if (pathname.startsWith('/(technician)/wallet') || pathname === '/wallet') return 'my-page';
  if (pathname === '/tech-ratings') return 'my-page';

  if (pathname.startsWith('/requests/')) return 'requests';
  if (pathname.startsWith('/messages'))  return 'requests';

  if (pathname === '/edit-profile')      return 'account';
  if (pathname.startsWith('/support'))   return 'account';

  return '';
}

function navigateTo(routeName: string) {
  Haptics.selectionAsync().catch(() => null);
  router.navigate(routeName === 'index' ? ('/(technician)' as any) : (`/(technician)/${routeName}` as any));
}

export function TechnicianTabBar() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const isWeb     = Platform.OS === 'web';
  const bottomPad = isWeb ? 8 : insets.bottom;
  const pathname  = usePathname();
  const activeTab = getActiveTab(pathname);
  const { get }   = useCmsSettings();
  const appName   = get(CMS_KEYS.APP_NAME, BRAND.NAME);
  const { locale, direction } = useLocale();
  const t = translations[locale];

  const SLOTS = [
    { routeName: 'index',    isLogo: true,  icon: undefined,   label: '' },
    { routeName: 'my-page',  isLogo: false, icon: 'layers',    label: t.tabs.techMyPage },
    { routeName: 'requests', isLogo: false, icon: 'clipboard', label: t.tabs.techRequests },
    { routeName: 'account',  isLogo: false, icon: 'user',      label: t.tabs.techAccount },
  ] as const;

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
        ]}
      />

      <View style={[styles.row, { flexDirection: 'row', direction }] as any}>
        {SLOTS.map((slot) => {
          const isFocused  = activeTab === slot.routeName;
          const iconColor  = isFocused ? colors.primary : colors.mutedForeground;

          return (
            <TouchableOpacity
              key={slot.routeName}
              style={styles.tab}
              onPress={() => navigateTo(slot.routeName)}
              activeOpacity={0.7}
            >
              {slot.isLogo ? (
                <AppLogo size={28} opacity={isFocused ? 1 : 0.35} />
              ) : (
                <Feather name={(slot as any).icon} size={22} color={iconColor} />
              )}
              <Text style={[styles.label, { color: iconColor }]} numberOfLines={1}>
                {slot.isLogo ? appName : slot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  row:       { height: TECH_TAB_BAR_HEIGHT, alignItems: 'center', paddingHorizontal: 4 },
  tab:       { flex: 1, alignItems: 'center', justifyContent: 'center', height: TECH_TAB_BAR_HEIGHT, gap: 3 },
  label:     { fontSize: 10, fontFamily: 'Cairo_500Medium' },
});
