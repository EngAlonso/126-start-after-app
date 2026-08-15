import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { AppHeader } from '@/components/AppHeader';
import { SkeletonList } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { PointsBalance, ServiceRequest, Rating } from '@/types';

interface PublicProfile {
  averageRating?: number;
  totalRatings?: number;
  ratings?: Rating[];
}

// ─── Two alternating card themes — matches the home screen palette ────────────
type CardTheme = { gradStart: string; gradEnd: string; border: string; iconBg: string; fg: string; priceBg: string; shadowColor: string };

const THEME_A: CardTheme = {
  gradStart: '#FFFBEB', gradEnd: '#FEF3C7',
  border: '#FCD34D', iconBg: '#FDE68A',
  fg: '#92400E', priceBg: '#D97706', shadowColor: '#D97706',
};
const THEME_B: CardTheme = {
  gradStart: '#EFF6FF', gradEnd: '#DBEAFE',
  border: '#93C5FD', iconBg: '#BFDBFE',
  fg: '#1E3A8A', priceBg: '#2563EB', shadowColor: '#2563EB',
};
const CARD_THEMES: CardTheme[] = [THEME_A, THEME_B];

// ─── Completed request card ───────────────────────────────────────────────────
const FALLBACK = '—';

function CompletedCard({ request, index }: { request: ServiceRequest; index: number }) {
  const theme = CARD_THEMES[index % 2];
  const { locale } = useLocale();
  const t = translations[locale];
  const price = request.agreedPrice ?? request.customerPayableAmount;

  const customerName  = (request as any).customer?.fullName || FALLBACK;
  const customerPhone = request.mobile || FALLBACK;
  const customerAddr  = request.address || FALLBACK;

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => router.push(`/requests/${request.id}` as any)}
      style={[cardStyles.wrapper, { shadowColor: theme.shadowColor, backgroundColor: theme.gradStart }]}
    >
      <LinearGradient
        colors={[theme.gradStart, theme.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[cardStyles.card, { borderColor: theme.border }]}
      >
        {/* Customer name (RIGHT) + icon badge (RIGHT) + chevron (LEFT) */}
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.iconBadge, { backgroundColor: theme.iconBg, borderColor: theme.border }]}>
            <Feather name="user" size={15} color={theme.fg} />
          </View>
          <Text style={[cardStyles.customerName, { color: theme.fg, flex: 1 }]} numberOfLines={1}>
            {customerName}
          </Text>
          <Feather name="chevron-left" size={16} color={theme.fg} style={{ opacity: 0.50 }} />
        </View>

        {/* Phone row */}
        <View style={cardStyles.infoRow}>
          <Feather name="phone" size={12} color={theme.fg} style={{ opacity: 0.70 }} />
          <Text style={[cardStyles.infoText, { color: theme.fg }]} numberOfLines={1}>
            {customerPhone}
          </Text>
        </View>

        {/* Address row */}
        <View style={cardStyles.infoRow}>
          <Feather name="map-pin" size={12} color={theme.fg} style={{ opacity: 0.70 }} />
          <Text style={[cardStyles.infoText, { color: theme.fg }]} numberOfLines={1} ellipsizeMode="tail">
            {customerAddr}
          </Text>
        </View>

        {/* Divider */}
        <View style={[cardStyles.divider, { backgroundColor: theme.border }]} />

        {/* Footer: price pill (RIGHT) + date (LEFT) */}
        <View style={cardStyles.footer}>
          {price ? (
            <View style={[cardStyles.pricePill, { backgroundColor: theme.priceBg, shadowColor: theme.shadowColor }]}>
              <Text style={cardStyles.priceText}>{fmtNumber(Number(price))} {t.common.currency}</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={cardStyles.metaRow}>
            <Feather name="calendar" size={10} color={theme.fg} style={{ opacity: 0.60 }} />
            <Text style={[cardStyles.metaText, { color: theme.fg, opacity: 0.72 }]}>
              {fmtDate(request.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 13, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  customerName: { fontSize: 15, fontFamily: 'Cairo_700Bold', textAlign: 'auto' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-start' },
  infoText: { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'auto', opacity: 0.80, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-start' },
  metaText: { fontSize: 11, fontFamily: 'Cairo_400Regular', textAlign: 'auto' },
  divider: { height: 1, opacity: 0.35 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pricePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 3, elevation: 2,
  },
  priceText: { color: '#fff', fontSize: 12, fontFamily: 'Cairo_700Bold' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TechnicianMyPageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  const { data: points, refetch: refetchPoints } = useQuery<PointsBalance>({
    queryKey: ['points-balance'],
    queryFn: () => authedFetch('/api/points/balance'),
    enabled: !!user,
  });

  // Requests needing offers (activity count)
  const { data: pending = [], refetch: refetchPending } = useQuery<ServiceRequest[]>({
    queryKey: ['requests', 'tech-pending'],
    queryFn: () => authedFetch('/api/requests?role=technician&status=pending&limit=50'),
    enabled: !!user,
  });

  const { data: techProfile, refetch: refetchProfile } = useQuery<PublicProfile>({
    queryKey: ['tech-public-profile', user?.id],
    queryFn: () => authedFetch(`/api/technicians/${user?.id}/public-profile`),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Completed requests
  const { data: completedEnvelope, isLoading: completedLoading, refetch: refetchCompleted } =
    useQuery<{ data: ServiceRequest[]; total: number }>({
      queryKey: ['requests', 'my-completed'],
      queryFn: () => authedFetch('/api/requests/my-completed?limit=5'),
      enabled: !!user,
    });
  const completed: ServiceRequest[] = completedEnvelope?.data ?? [];

  useRefetchOnFocus([refetchPoints, refetchPending, refetchProfile, refetchCompleted]);

  const needsOffer = pending.length;
  const lowPoints = points && points.available < 200;

  const avgRating: number = (() => { const v = Number(techProfile?.averageRating); return isFinite(v) ? v : 0; })();
  const totalRatings: number = (() => { const v = Number(techProfile?.totalRatings); return isFinite(v) && v >= 0 ? Math.round(v) : 0; })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' } as any}>
      <AppHeader role="technician" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TECH_TAB_BAR_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. Greeting ── */}
        <View style={[styles.greetRow, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
          <Text style={[styles.greetName, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
            {t.greeting.techPrefix}، {user?.fullName?.split(' ')[0] ?? t.greeting.techFallback} {t.greeting.techEmoji}
          </Text>
        </View>

        {/* ── 2. Three premium stat cards ── */}
        <View style={styles.statsRow}>

          {/* Rating card */}
          <TouchableOpacity
            style={[styles.statCard, { shadowColor: '#16A34A', borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}
            onPress={() => router.push('/tech-ratings')}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['#F0FDF4', '#DCFCE7', '#DCFCE733']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardInner}
            >
              <View style={[styles.statDecorCircle, { backgroundColor: '#BBF7D066', bottom: -20, left: -20 }]} />
              <View style={[styles.statDecorCircle, { width: 36, height: 36, borderRadius: 18, backgroundColor: '#BBF7D044', top: -10, right: 32 }]} />
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Feather name="star" size={16} color="#16A34A" />
                </View>
                <Text style={[styles.statLabel, { color: '#166534' }]} numberOfLines={2}>
                  {totalRatings > 0 ? t.techMyPage.ratingCount(totalRatings) : t.techMyPage.statRating}
                </Text>
              </View>
              <Text style={[styles.statValue, { color: '#166534' }]}>
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Active requests card */}
          <TouchableOpacity
            style={[styles.statCard, { shadowColor: '#2563EB', borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }]}
            onPress={() => router.push('/(technician)/requests')}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['#EFF6FF', '#DBEAFE', '#DBEAFE33']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardInner}
            >
              <View style={[styles.statDecorCircle, { backgroundColor: '#BFDBFE66', bottom: -20, left: -20 }]} />
              <View style={[styles.statDecorCircle, { width: 36, height: 36, borderRadius: 18, backgroundColor: '#BFDBFE44', top: -10, right: 32 }]} />
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: '#BFDBFE' }]}>
                  <Feather name="clipboard" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.statLabel, { color: '#1E40AF' }]} numberOfLines={2}>{t.techMyPage.statActiveRequests}</Text>
              </View>
              <Text style={[styles.statValue, { color: '#1E3A8A' }]}>{(needsOffer ?? 0).toLocaleString('en-US')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Points card */}
          <TouchableOpacity
            style={[styles.statCard, { shadowColor: '#D97706', borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}
            onPress={() => router.push('/(technician)/wallet')}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={lowPoints ? ['#FEF3C7', '#FDE68A', '#FDE68A33'] : ['#FFFBEB', '#FEF3C7', '#FDE68A33']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardInner}
            >
              <View style={[styles.statDecorCircle, { backgroundColor: '#FDE68A99', bottom: -20, left: -20 }]} />
              <View style={[styles.statDecorCircle, { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE68A66', top: -10, right: 32 }]} />
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: '#FDE68A' }]}>
                  <Feather name="zap" size={16} color={lowPoints ? '#B45309' : '#D97706'} />
                </View>
                <Text style={[styles.statLabel, { color: '#B45309' }]} numberOfLines={2}>{t.techMyPage.statPoints}</Text>
              </View>
              <Text style={[styles.statValue, { color: '#92400E' }]}>
                {points?.available ?? '—'}
              </Text>
              {lowPoints && (
                <Text style={styles.statWarn}>{t.techMyPage.statLowPoints}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </View>

        {/* ── 3. Completed requests section ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.techMyPage.completedRequests}</Text>
        </View>

        {completedLoading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SkeletonList count={2} height={130} />
          </View>
        ) : completed.length === 0 ? (
          <View style={{ height: 130 }}>
            <EmptyState icon="check-circle" title={t.techMyPage.noCompleted} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {completed.slice(0, 3).map((r, i) => (
              <CompletedCard key={r.id} request={r} index={i} />
            ))}
            <TouchableOpacity
              style={[styles.showMoreBtn, { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}
              onPress={() => router.push({ pathname: '/(technician)/requests', params: { initialTab: '2' } } as any)}
              activeOpacity={0.78}
            >
              <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={15} color="#92400E" />
              <Text style={[styles.showMoreText, { color: '#92400E' }]}>{t.techMyPage.showMore}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  greetRow: { paddingHorizontal: 20, paddingVertical: 16 },
  greetName: { fontSize: 20, fontFamily: 'Cairo_700Bold' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  statCardInner: {
    borderRadius: 20,
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  statDecorCircle: {
    position: 'absolute',
    width: 70, height: 70, borderRadius: 35,
    pointerEvents: 'none',
  } as any,
  statValue: { fontSize: 30, lineHeight: 38, fontFamily: 'Cairo_700Bold', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto', flex: 1, marginRight: 5 },
  statWarn: { fontSize: 10, fontFamily: 'Cairo_600SemiBold', color: '#92400E' },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },

  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 12, marginTop: 2, marginBottom: 4,
  },
  showMoreText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
});
