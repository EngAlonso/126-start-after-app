import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, apiFetch } from '@/hooks/useApi';
import { useSse } from '@/hooks/useSse';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { AppHeader } from '@/components/AppHeader';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { ServiceRequest, PointsBalance, Service } from '@/types';

// ─── Status icons & colors (labels come from translations at render time) ──────
type StatusMeta = { icon: keyof typeof Feather.glyphMap; color: string };
const STATUS_META: Record<string, StatusMeta> = {
  completed:               { icon: 'check-circle', color: '#16A34A' },
  in_progress:             { icon: 'tool',         color: '#2563EB' },
  waiting_approval:        { icon: 'alert-circle', color: '#D97706' },
  technician_selected:     { icon: 'user-check',   color: '#D97706' },
  price_change_requested:  { icon: 'dollar-sign',  color: '#7C3AED' },
  cancelled:               { icon: 'x-circle',     color: '#DC2626' },
  cancelled_by_customer:   { icon: 'x-circle',     color: '#DC2626' },
  cancelled_by_technician: { icon: 'x-circle',     color: '#DC2626' },
};
const STATUS_DEFAULT: StatusMeta = { icon: 'circle', color: '#6B7280' };

// ─── Two fixed alternating card themes (Fnashha brand palette) ───────────────
type CardTheme = { gradStart: string; gradEnd: string; border: string; iconBg: string; fg: string; priceBg: string; shadowColor: string };

const THEME_A: CardTheme = {
  gradStart:   '#FFFBEB',
  gradEnd:     '#FEF3C7',
  border:      '#FCD34D',
  iconBg:      '#FDE68A',
  fg:          '#92400E',
  priceBg:     '#D97706',
  shadowColor: '#D97706',
};

const THEME_B: CardTheme = {
  gradStart:   '#EFF6FF',
  gradEnd:     '#DBEAFE',
  border:      '#93C5FD',
  iconBg:      '#BFDBFE',
  fg:          '#1E3A8A',
  priceBg:     '#2563EB',
  shadowColor: '#2563EB',
};

const CARD_THEMES: CardTheme[] = [THEME_A, THEME_B];

// ─── Premium card for current requests ───────────────────────────────────────
function CurrentRequestCard({
  request,
  index,
  serviceMap,
}: {
  request: ServiceRequest;
  index: number;
  serviceMap: Record<number, Service>;
}) {
  const { locale } = useLocale();
  const t = translations[locale];

  const theme = CARD_THEMES[index % 2];
  const statusMeta = STATUS_META[request.status] ?? STATUS_DEFAULT;
  const statusLabel = (t.requestStatus as any)[request.status] ?? '—';
  const price = request.agreedPrice ?? request.customerPayableAmount;

  const service: Service | null | undefined =
    request.service ?? serviceMap[request.serviceId] ?? null;

  const location =
    request.area?.nameAr && request.governorate?.nameAr
      ? `${request.area.nameAr}، ${request.governorate.nameAr}`
      : request.address ?? null;

  const customerName = request.customer?.fullName ?? request.fullName ?? null;

  const handlePress = () => router.push(`/requests/${request.id}` as any);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={handlePress}
      style={[recentStyles.wrapper, { shadowColor: theme.shadowColor, backgroundColor: theme.gradStart }]}
    >
      <LinearGradient
        colors={[theme.gradStart, theme.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[recentStyles.card, { borderColor: theme.border }]}
      >
        {/* ── Top row: service icon badge (RIGHT) + name + arrow (LEFT) ── */}
        <View style={recentStyles.topRow}>
          <View style={[recentStyles.iconBadge, { backgroundColor: theme.iconBg, borderColor: theme.border }]}>
            {service?.icon ? (
              <Text style={recentStyles.iconEmoji}>{service.icon}</Text>
            ) : service?.image ? (
              <Image
                source={{ uri: service.image }}
                style={recentStyles.serviceImg}
                resizeMode="contain"
              />
            ) : (
              <Feather name="tool" size={16} color={theme.fg} style={{ opacity: 0.50 }} />
            )}
          </View>

          <Text style={[recentStyles.serviceName, { color: theme.fg, flex: 1 }]} numberOfLines={1}>
            {service?.nameAr || service?.name || '—'}
          </Text>

          <Feather name="chevron-left" size={18} color={theme.fg} style={{ opacity: 0.50 }} />
        </View>

        {/* ── Customer name row ── */}
        {customerName ? (
          <View style={recentStyles.customerRow}>
            <Text style={[recentStyles.customerName, { color: theme.fg }]} numberOfLines={1}>
              {customerName}
            </Text>
            <Feather name="user" size={13} color={theme.fg} style={{ opacity: 0.70 }} />
          </View>
        ) : null}

        {/* ── Status badge (RIGHT) + request ID (LEFT) ── */}
        <View style={recentStyles.badgeRow}>
          <View style={[recentStyles.statusBadge, { backgroundColor: statusMeta.color + '15', borderColor: statusMeta.color + '40' }]}>
            <Feather name={statusMeta.icon} size={11} color={statusMeta.color} />
            <Text style={[recentStyles.statusText, { color: statusMeta.color }]}>{statusLabel}</Text>
          </View>

          <View style={[recentStyles.idPill, { backgroundColor: theme.iconBg, borderColor: theme.border }]}>
            <Text style={[recentStyles.idText, { color: theme.fg }]}>#{request.id}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={[recentStyles.divider, { backgroundColor: theme.border }]} />

        {/* ── Footer: price pill + date/location ── */}
        <View style={recentStyles.footer}>
          {price ? (
            <View style={[recentStyles.pricePill, { backgroundColor: theme.priceBg, shadowColor: theme.shadowColor }]}>
              <Text style={recentStyles.priceText}>{fmtNumber(Number(price))} {t.common.currency}</Text>
            </View>
          ) : (
            <View />
          )}

          <View style={recentStyles.metaCol}>
            {location ? (
              <View style={recentStyles.metaRow}>
                <Feather name="map-pin" size={11} color={theme.fg} style={{ opacity: 0.60 }} />
                <Text style={[recentStyles.metaText, { color: theme.fg, opacity: 0.72 }]} numberOfLines={1}>{location}</Text>
              </View>
            ) : null}
            <View style={recentStyles.metaRow}>
              <Feather name="calendar" size={11} color={theme.fg} style={{ opacity: 0.60 }} />
              <Text style={[recentStyles.metaText, { color: theme.fg, opacity: 0.72 }]}>
                {fmtDate(request.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Empty state for current requests ────────────────────────────────────────
function CurrentRequestsEmpty() {
  const { locale } = useLocale();
  const t = translations[locale];

  return (
    <LinearGradient
      colors={['#FFFBEB', '#FEF3C7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={emptyStyles.container}
    >
      <View style={emptyStyles.iconCircle}>
        <Feather name="briefcase" size={28} color="#D97706" />
      </View>
      <Text style={emptyStyles.title}>{t.techHome.noCurrent}</Text>
      <Text style={emptyStyles.subtitle}>{t.techHome.noCurrentSubtitle}</Text>
    </LinearGradient>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDE68A',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    color: '#92400E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    color: '#92400E',
    opacity: 0.72,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const recentStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    borderRadius: 22,
    shadowColor: '#92400E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  serviceImg: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'auto',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  customerName: {
    fontSize: 13,
    fontFamily: 'Cairo_500Medium',
    textAlign: 'auto',
    opacity: 0.85,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  idPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  idText: {
    fontSize: 11,
    fontFamily: 'Cairo_700Bold',
  },
  divider: {
    height: 1,
    opacity: 0.4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pricePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  priceText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },
});

export default function TechnicianHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];
  useSse();

  const { data: points, refetch: refetchPoints } = useQuery<PointsBalance>({
    queryKey: ['points-balance'],
    queryFn: () => authedFetch('/api/points/balance'),
    enabled: !!user,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch('/api/services?active=true'),
    staleTime: 5 * 60 * 1000,
  });

  const serviceMap: Record<number, Service> = React.useMemo(() => {
    const map: Record<number, Service> = {};
    for (const s of services) map[s.id] = s;
    return map;
  }, [services]);

  const { data: availableEnvelope, isLoading: availLoading, refetch: refetchAvailable } = useQuery<{ data: ServiceRequest[]; total: number }>({
    queryKey: ['requests', 'available'],
    queryFn: () => authedFetch('/api/requests?role=technician&status=pending&limit=20'),
    enabled: !!user,
  });
  const available: ServiceRequest[] = availableEnvelope?.data ?? [];

  const { data: currentRaw, isLoading: currentLoading, refetch: refetchCurrent } = useQuery<ServiceRequest[] | { data: ServiceRequest[] }>({
    queryKey: ['requests', 'tech-current'],
    queryFn: () => authedFetch('/api/requests?role=technician&status=technician_selected,in_progress,waiting_approval,price_change_requested&limit=20'),
    enabled: !!user,
  });
  const current: ServiceRequest[] = Array.isArray(currentRaw)
    ? currentRaw
    : (currentRaw as any)?.data ?? [];

  useRefetchOnFocus([refetchPoints, refetchAvailable, refetchCurrent]);

  const lowPoints = points && points.available < 200;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="technician" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TECH_TAB_BAR_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={[styles.greetRow, { alignItems: 'flex-start' }]}>
          <Text style={[styles.greetName, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
            {t.greeting.techPrefix}، {user?.fullName?.split(' ')[0] ?? t.greeting.techFallback} {t.greeting.techEmoji}
          </Text>
        </View>

        {/* Low points warning */}
        {lowPoints && (
          <TouchableOpacity
            style={[styles.warning, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}
            onPress={() => router.push('/(technician)/wallet')}
            activeOpacity={0.8}
          >
            <Text style={[styles.warningText, { color: '#92400E' }]}>
              {t.techHome.lowPointsWarning(points?.available ?? 0)}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Available Requests ── */}
        <SectionHeader
          title={t.techHome.availableRequests}
          seeAllLabel={t.common.seeAll}
          onSeeAll={() => router.push('/(technician)/requests')}
          colors={colors}
        />

        {availLoading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SkeletonList count={3} height={110} />
          </View>
        ) : available.length === 0 ? (
          <View style={{ height: 160 }}>
            <EmptyState icon="inbox" title={t.techHome.noAvailable} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {available.slice(0, 5).map(r => <RequestCard key={r.id} request={r} />)}
          </View>
        )}

        {/* ── Current Assigned Requests ── */}
        <SectionHeader
          title={t.techHome.currentRequests}
          seeAllLabel={t.common.seeAll}
          onSeeAll={() => router.push('/(technician)/requests')}
          colors={colors}
        />

        {currentLoading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SkeletonList count={2} height={160} />
          </View>
        ) : current.length === 0 ? (
          <CurrentRequestsEmpty />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {current.slice(0, 3).map((r, i) => (
              <CurrentRequestCard key={r.id} request={r} index={i} serviceMap={serviceMap} />
            ))}
            <TouchableOpacity
              style={[styles.showMoreBtn, { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}
              onPress={() => router.push('/(technician)/requests')}
              activeOpacity={0.78}
            >
              <Text style={[styles.showMoreText, { color: '#92400E' }]}>{t.techHome.showMore}</Text>
              <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={15} color="#92400E" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title, seeAllLabel, onSeeAll, colors,
}: {
  title: string; seeAllLabel?: string; onSeeAll?: () => void; colors: any;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>{seeAllLabel ?? ''}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  greetRow: { alignSelf: 'stretch', paddingHorizontal: 20, paddingVertical: 16 },
  greetName: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  warning: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  warningText: { fontSize: 13, fontFamily: 'Cairo_500Medium', textAlign: 'auto' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  seeAll: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  showMoreText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
});
