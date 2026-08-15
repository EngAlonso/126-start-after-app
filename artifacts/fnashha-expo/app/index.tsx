/**
 * Guest Home Screen — /
 *
 * The app's public entry point. Shown to unauthenticated users.
 * Authenticated users are redirected to their role home by the AuthGate
 * in _layout.tsx before this screen ever renders.
 *
 * The root AuthGate owns the one-time intro decision before this screen
 * renders, so this route only owns guest-home content.
 *
 * Guests can freely:
 *   • View banners
 *   • Browse services
 *   • Open service details
 *
 * Protected actions (create request, wallet, messages, etc.) require login.
 */
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiFetch } from '@/hooks/useApi';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { BannerSlider } from '@/components/BannerSlider';
import { ServiceCard } from '@/components/ServiceCard';
import { HowToRequest } from '@/components/HowToRequest';
import type { Service, Banner } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

const MAX_HOME_SERVICES = 6;

export default function GuestHomeScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { get } = useCmsSettings();
  const topPad = Platform.OS === 'web' ? 12 : insets.top;

  const logoUrl = get(CMS_KEYS.LOGO_URL);
  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);

  // ── Public API queries ────────────────────────────────────────────────────
  const { data: banners = [], isLoading: bannersLoading, refetch: refetchBanners } = useQuery<Banner[]>({
    queryKey: ['banners', 'offers_page'],
    queryFn: () => apiFetch('/api/banners?location=offers_page'),
    enabled: true,
  });

  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch('/api/services?active=true'),
    enabled: true,
  });

  useRefetchOnFocus([refetchBanners, refetchServices]);

  const homeServices = services.slice(0, MAX_HOME_SERVICES);
  const hasMore = services.length > MAX_HOME_SERVICES;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: 'row' }]}>
        {/* Logo (visual right in RTL) */}
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text style={[styles.appNameText, { color: colors.primary }]}>{appName}</Text>
        )}

        {/* Login / Register buttons (visual left in RTL) */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>{t.guestHome.loginBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.registerBtn, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
            onPress={() => router.push('/register-select' as any)}
            activeOpacity={0.85}
          >
            <Text style={[styles.registerBtnText, { color: colors.primaryDark }]}>{t.guestHome.joinBtn}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banners */}
        <View style={{ marginTop: 16, marginBottom: 28 }}>
          {bannersLoading ? (
            <View style={[styles.bannerSkeleton, { backgroundColor: colors.muted }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <BannerSlider banners={banners} />
          )}
        </View>

        {/* Services */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.customerHome.ourServices}</Text>
          {hasMore && (
            <TouchableOpacity onPress={() => router.push('/services')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>{t.common.seeAll}</Text>
            </TouchableOpacity>
          )}
        </View>

        {servicesLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : homeServices.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="tool" size={34} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t.customerHome.noServices}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {homeServices.map(svc => (
              <View key={svc.id} style={styles.gridCell}>
                <ServiceCard
                  service={svc}
                  onPress={() => router.push(`/services/${svc.id}` as any)}
                />
              </View>
            ))}
          </View>
        )}

        {/* How it works */}
        <HowToRequest />

        {/* CTA */}
        <View style={[styles.ctaBox, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          <Feather name="user-plus" size={28} color={colors.primary} />
          <Text style={[styles.ctaTitle, { color: colors.foreground }]}>{t.guestHome.ctaTitle}</Text>
          <Text style={[styles.ctaDesc, { color: colors.mutedForeground }]}>{t.guestHome.ctaDesc}</Text>
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/login' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>{t.guestHome.loginCta}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaBtnOutline, { borderColor: colors.primary }]}
              onPress={() => router.push('/register')}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaBtnOutlineText, { color: colors.primary }]}>{t.guestHome.registerCta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  logo: { width: 40, height: 40, borderRadius: 10 },
  appNameText: { fontSize: 22, fontFamily: 'Cairo_700Bold' },
  headerActions: { flexDirection: 'row', gap: 8 },
  loginBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  loginBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  registerBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  registerBtnText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  bannerSkeleton: { marginHorizontal: 16, height: 168, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  seeAll: { fontSize: 14, fontFamily: 'Cairo_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  gridCell: { width: '50%', paddingHorizontal: 4 },
  loadingBox: { paddingVertical: 48, alignItems: 'center' },
  emptyBox: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  ctaBox: { margin: 16, borderRadius: 16, padding: 24, borderWidth: 1, alignItems: 'center', gap: 10, marginTop: 8 },
  ctaTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  ctaDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  ctaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  ctaBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  ctaBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Cairo_700Bold' },
  ctaBtnOutline: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5 },
  ctaBtnOutlineText: { fontSize: 15, fontFamily: 'Cairo_700Bold' },
});
