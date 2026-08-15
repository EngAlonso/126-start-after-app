/**
 * Customer My Page
 *
 * Banner  — matches web customer dashboard exactly:
 *   endpoint  /api/banners?location=customer_dashboard
 *   queryKey  ['banners', 'customer_dashboard']
 *   filter    b.isActive  (client-side, mirrors web)
 *   staleTime 60_000
 *
 * Requests — shares the same React Query cache as the Requests tab:
 *   queryKey  ['requests', 'customer']
 *   active filter = same 8-status set as web ACTIVE_STATUSES
 */
import React, { useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, apiFetch, resolveMediaUrl } from '@/hooks/useApi';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { AppHeader } from '@/components/AppHeader';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { BannerSlider } from '@/components/BannerSlider';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { LoyaltyWallet, Banner, ServiceRequest } from '@/types';

// ─── Active statuses — exact copy from web customer/dashboard.tsx ─────────
const ACTIVE_STATUSES = new Set([
  'pending', 'offers_received', 'technician_selected', 'in_progress',
  'price_change_requested', 'waiting_approval', 'awaiting_completion', 'disputed',
]);

// Status colors only (labels come from translations at render time)
const STATUS_COLORS: Record<string, string> = {
  pending:                 '#2563EB',
  offers_received:         '#7C3AED',
  technician_selected:     '#EA580C',
  in_progress:             '#4F46E5',
  price_change_requested:  '#F97316',
  waiting_approval:        '#D97706',
  awaiting_completion:     '#0EA5E9',
  disputed:                '#EF4444',
  completed:               '#16A34A',
  cancelled:               '#DC2626',
  cancelled_by_customer:   '#DC2626',
  cancelled_by_technician: '#DC2626',
  rejected:                '#DC2626',
};

// ─── Animated press wrapper ───────────────────────────────────────────────
function PressCard({
  style,
  onPress,
  children,
}: {
  style: any;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      tension: 300,
      friction: 14,
    }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => spring(0.96)}
      onPressOut={() => spring(1)}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────
export default function CustomerMyPageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { get } = useCmsSettings();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];
  const avatarUri = resolveMediaUrl(user?.profileImage);

  // Loyalty wallet
  const { data: wallet, refetch: refetchWallet } = useQuery<LoyaltyWallet>({
    queryKey: ['wallet'],
    queryFn: () => authedFetch('/api/loyalty/wallet'),
    enabled: !!user,
  });

  // Loyalty config
  const { data: loyaltyConfig } = useQuery<any>({
    queryKey: ['loyalty-config'],
    queryFn: () => authedFetch('/api/loyalty/config'),
    staleTime: 120_000,
  });
  const referralReward: number = loyaltyConfig?.referralReferrerCoins ?? 0;
  const coinName: string = loyaltyConfig?.coinName ?? t.referralScreen.coinFallback;
  const loyaltyEnabled = get(CMS_KEYS.LOYALTY_ENABLED, 'true') !== 'false';
  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);
  const approxDiscount: number = (wallet as any)?.approximateDiscountValue ?? 0;

  // ── Banner: same source as web customer dashboard ──────────────────────
  const { data: rawBanners = [], refetch: refetchBanners } = useQuery<Banner[]>({
    queryKey: ['banners', 'customer_dashboard'],
    queryFn: async () => {
      const data = await apiFetch('/api/banners?location=customer_dashboard');
      return Array.isArray(data) ? data.filter((b: any) => b.isActive) : [];
    },
    staleTime: 60_000,
  });

  // ── Active requests: reuses the same React Query cache as the Requests tab
  const { data: rawRequestsResult, isLoading: reqLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['requests', 'customer'],
    queryFn: () => authedFetch('/api/requests?role=customer&limit=100'),
    enabled: !!user,
  });

  useRefetchOnFocus([refetchWallet, refetchBanners, refetchRequests]);
  const allRequests: ServiceRequest[] = Array.isArray(rawRequestsResult)
    ? rawRequestsResult
    : Array.isArray((rawRequestsResult as any)?.requests)
      ? (rawRequestsResult as any).requests
      : Array.isArray((rawRequestsResult as any)?.data)
        ? (rawRequestsResult as any).data
        : [];
  const activeRequests = allRequests.filter(r => ACTIVE_STATUSES.has(r.status as string));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="customer" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Welcome row ────────────────────────────────────────────── */}
        <View style={styles.welcomeRow}>
          {/* Text column */}
          <View style={styles.welcomeTextCol}>
            <Text style={[styles.welcomeSub, { color: colors.mutedForeground }]}>{`${t.customerMyPage.welcome} ${appName}`}</Text>
            <Text style={[styles.welcomeName, { color: colors.foreground }]}>
              {user?.fullName ?? '—'} 👋
            </Text>
          </View>
          {/* Avatar */}
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{user?.fullName?.[0] ?? '؟'}</Text>
            </View>
          )}
        </View>

        {/* ── CMS banner carousel (customer_dashboard location) ─────── */}
        {rawBanners.length > 0 && (
          <BannerSlider banners={rawBanners} height={140} style={{ marginBottom: 20 }} />
        )}

        {/* ── Loyalty cards ─────────────────────────────────────────── */}
        {loyaltyEnabled && (
          <View style={styles.cardsRow}>

            {/* ── Coins card ─────────────────────────────────────────── */}
            <PressCard
              style={[
                styles.cardOuter,
                {
                  shadowColor: '#F59E0B',
                  borderColor: '#FDE68A',
                  backgroundColor: '#FFFBEB',
                },
              ]}
              onPress={() => router.push('/customer-wallet')}
            >
              <LinearGradient
                colors={['#FFFBEB', '#FEF3C7', '#FDE68A33']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardInner}
              >
                {/* Background decoration */}
                <View style={[styles.cardDecorCircle, { backgroundColor: 'rgba(253,230,138,0.6)', bottom: -20, left: -20 }]} />
                <View style={[styles.cardDecorCircle, { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(253,230,138,0.4)', top: -10, right: 32 }]} />

                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.iconPillYellow}>
                    <Text style={{ fontSize: 16 }}>⭐</Text>
                  </View>
                  <Text style={styles.coinLabel}>{coinName}</Text>
                </View>

                {/* Coin value */}
                <Text style={styles.coinValueLarge}>
                  {wallet ? fmtNumber(wallet.availableCoins) : '—'}
                </Text>

                {/* Approx discount */}
                {approxDiscount > 0 ? (
                  <View style={styles.approxRow}>
                    <Text style={styles.approxText}>{t.customerMyPage.approxPrefix} {approxDiscount.toFixed(2)} {t.customerMyPage.discountSuffix}</Text>
                  </View>
                ) : (
                  <View style={styles.cardCta}>
                    <Text style={styles.coinCtaText}>{t.customerMyPage.viewWallet}</Text>
                    <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={12} color="#B45309" />
                  </View>
                )}
              </LinearGradient>
            </PressCard>

            {/* ── Referral card ──────────────────────────────────────── */}
            <PressCard
              style={[
                styles.cardOuter,
                {
                  shadowColor: colors.primary,
                  borderColor: colors.primary + '40',
                  backgroundColor: colors.primaryLight,
                },
              ]}
              onPress={() => router.push('/referral')}
            >
              <LinearGradient
                colors={[colors.primary + '10', colors.primary + '20', colors.primary + '0A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardInner}
              >
                {/* Background decoration */}
                <View style={[styles.cardDecorCircle, { backgroundColor: colors.primary + '18', bottom: -20, left: -20 }]} />
                <View style={[styles.cardDecorCircle, { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '10', top: -10, right: 32 }]} />

                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={[styles.iconPillPrimary, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="gift" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.refLabel, { color: colors.primary }]}>{t.customerMyPage.referral}</Text>
                </View>

                {/* Reward info */}
                <Text style={[styles.refTitle, { color: colors.foreground }]}>{t.customerMyPage.inviteFriend}</Text>
                <View style={styles.cardCta}>
                  <Text style={[styles.refReward, { color: colors.primary }]}>
                    +{fmtNumber(referralReward)} {coinName}
                  </Text>
                  <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={12} color={colors.primary} />
                </View>
              </LinearGradient>
            </PressCard>

          </View>
        )}

        {/* ── Active requests ──────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.customerMyPage.activeRequests}</Text>
            <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
          </View>

          {reqLoading ? (
            [0, 1, 2].map(i => (
              <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.muted }]} />
            ))
          ) : activeRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <LinearGradient
                colors={['#FFFBEB', '#FEF3C7', '#FDE68A33']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyGradient}
              >
                {/* Decorative circles */}
                <View style={[styles.emptyDecorCircle, { width: 110, height: 110, borderRadius: 55, bottom: -30, left: -30 }]} />
                <View style={[styles.emptyDecorCircle, { width: 52, height: 52, borderRadius: 26, top: -14, right: 76, opacity: 0.4 }]} />

                <View style={styles.emptyIconBadge}>
                  <Feather name="clipboard" size={30} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>{t.customerMyPage.noActiveRequests}</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  {t.customerMyPage.noActiveSubtitle}
                </Text>
              </LinearGradient>
            </View>
          ) : (
            activeRequests.map(r => {
              const statusColor = STATUS_COLORS[r.status] ?? '#6B7280';
              const statusLabel = (t.requestStatus as any)[r.status] ?? r.status;
              const price = r.agreedPrice ?? r.customerPayableAmount;
              const techName = r.selectedTechnician?.fullName;

              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.reqCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRightWidth: 3,
                      borderRightColor: statusColor + 'BB',
                    },
                  ]}
                  onPress={() => router.push(`/requests/${r.id}` as any)}
                  activeOpacity={0.75}
                >
                  {/* Top row: service name + chevron */}
                  <View style={styles.reqTopRow}>
                    <Text style={[styles.reqService, { color: colors.foreground }]} numberOfLines={1}>
                      {r.service?.nameAr || r.description?.substring(0, 40) || `#${r.id}`}
                    </Text>
                    <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.mutedForeground} />
                  </View>

                  {/* Status badge */}
                  <View style={styles.reqMidRow}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40', borderWidth: 1 }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>

                    {/* Technician name if assigned */}
                    {techName ? (
                      <View style={styles.techRow}>
                        <Text style={[styles.techName, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {techName}
                        </Text>
                        <Feather name="tool" size={11} color={colors.mutedForeground} />
                      </View>
                    ) : null}
                  </View>

                  {/* Footer: price (RIGHT) + date (LEFT) */}
                  <View style={styles.reqFooter}>
                    {price ? (
                      <Text style={[styles.reqPrice, { color: colors.primary }]}>
                        {fmtNumber(Number(price))} {t.common.currency}
                      </Text>
                    ) : <View />}
                    <View style={styles.dateRow}>
                      <Text style={[styles.reqDate, { color: colors.mutedForeground }]}>
                        {fmtDate(r.createdAt, { day: 'numeric', month: 'short' })}
                      </Text>
                      <Feather name="calendar" size={11} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Welcome ────────────────────────────────────────────────────────────
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 14,
  },
  welcomeTextCol: { flex: 1, alignItems: 'flex-start' },
  welcomeSub:  { fontSize: 12, fontFamily: 'Cairo_400Regular', opacity: 0.7, marginBottom: 1 },
  welcomeName: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  avatar:      { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontFamily: 'Cairo_700Bold' },

  // ── Cards ──────────────────────────────────────────────────────────────
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 28,
  },
  cardOuter: {
    flex: 1,
    borderRadius: 20,
    // NOTE: no overflow:'hidden' — on Android, elevation + overflow:'hidden' renders a white rectangle.
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  cardInner: {
    borderRadius: 20,
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  // Icon pills
  iconPillYellow: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FDE68A',
    alignItems: 'center', justifyContent: 'center',
  },
  iconPillPrimary: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  // Decorative background circles
  cardDecorCircle: {
    position: 'absolute',
    width: 70, height: 70, borderRadius: 35,
    pointerEvents: 'none',
  } as any,

  // Coins card text
  coinLabel:     { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: '#92400E' },
  coinValueLarge:{ fontSize: 30, fontFamily: 'Cairo_700Bold', color: '#78350F', letterSpacing: -0.5 },
  approxRow:     { flexDirection: 'row', alignItems: 'center' },
  approxText:    { fontSize: 11, fontFamily: 'Cairo_500Medium', color: '#B45309' },

  // CTA row (shared by both cards)
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  coinCtaText: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: '#B45309' },

  // Referral card text
  refLabel: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  refTitle:  { fontSize: 17, fontFamily: 'Cairo_700Bold', marginBottom: 4 },
  refReward: { fontSize: 13, fontFamily: 'Cairo_700Bold' },

  // ── Requests section ────────────────────────────────────────────────────
  section: { paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  sectionDot:   { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 17, fontFamily: 'Cairo_700Bold' },

  reqCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reqTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqService: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'auto',
  },
  reqMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  techName: { fontSize: 12, fontFamily: 'Cairo_400Regular', flexShrink: 1 },

  reqFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqDate:  { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  reqPrice: { fontSize: 15, fontFamily: 'Cairo_700Bold' },

  // Skeleton / empty state
  skeletonCard: { height: 92, borderRadius: 16, marginBottom: 10, opacity: 0.4 },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyGradient: {
    borderRadius: 22,
    paddingVertical: 44,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  emptyDecorCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(253,230,138,0.55)',
  },
  emptyIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245,158,11,0.13)',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Cairo_700Bold', color: '#78350F' },
  emptyBody:  { fontSize: 13, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', color: '#B45309' },
});
