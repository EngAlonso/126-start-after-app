import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/hooks/useApi';
import { useSse } from '@/hooks/useSse';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { AppHeader } from '@/components/AppHeader';
import { BannerSlider } from '@/components/BannerSlider';
import { ServiceCard } from '@/components/ServiceCard';
import { HowToRequest } from '@/components/HowToRequest';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { Service, Banner } from '@/types';

const MAX_HOME_SERVICES = 6;

function makeGreeting(t: typeof translations['ar']): string {
  const h = new Date().getHours();
  if (h < 12) return t.greeting.morning;
  if (h < 17) return t.greeting.afternoon;
  return t.greeting.evening;
}

export default function CustomerHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];
  useSse();

  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch('/api/services?active=true'),
  });

  const { data: banners = [], isLoading: bannersLoading, refetch: refetchBanners } = useQuery<Banner[]>({
    queryKey: ['banners', 'offers_page'],
    queryFn: () => apiFetch('/api/banners?location=offers_page'),
  });

  useRefetchOnFocus([refetchServices, refetchBanners]);

  const homeServices = services.slice(0, MAX_HOME_SERVICES);
  const hasMore = services.length > MAX_HOME_SERVICES;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="customer" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={[styles.greetRow, { alignItems: 'flex-start' }]}>
          <Text style={[styles.greetName, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
            {makeGreeting(t)}، {user?.fullName?.split(' ')[0] ?? t.greeting.fallback} 👋
          </Text>
          <Text style={[styles.greetSub, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
            {t.greeting.subtitle}
          </Text>
        </View>

        {/* Banners */}
        <View style={{ marginBottom: 28 }}>
          {bannersLoading ? (
            <View style={[styles.bannerSkeleton, { backgroundColor: colors.muted }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <BannerSlider banners={banners} />
          )}
        </View>

        {/* Services section */}
        <View style={[styles.sectionRow, { flexDirection: isRTL ? 'row' : 'row-reverse' }]}>
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

        {/* How to request section */}
        <HowToRequest />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  greetRow: { alignSelf: 'stretch', paddingHorizontal: 20, paddingVertical: 16 },
  greetName: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  greetSub: { fontSize: 13, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  bannerSkeleton: { marginHorizontal: 16, height: 168, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  seeAll: { fontSize: 14, fontFamily: 'Cairo_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  gridCell: { width: '50%', paddingHorizontal: 4 },
  loadingBox: { paddingVertical: 48, alignItems: 'center' },
  emptyBox: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
});
