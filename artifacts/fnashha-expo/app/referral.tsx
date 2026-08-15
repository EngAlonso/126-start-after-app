import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import type { LoyaltyWallet } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

// ── API response shapes ───────────────────────────────────────────────────────

interface LoyaltyConfig {
  coinName: string;
  referralEnabled: boolean;
  referralReferrerCoins: number;
  referralRefereeCoins: number;
}

interface ReferralStats {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
  totalRewardsEarned: number;
}

interface ReferralHistoryItem {
  id: number;
  refereeName: string;
  status: string;
  referrerRewarded: boolean;
  rewardedAt: string | null;
  createdAt: string;
}

interface ReferralData {
  referralCode: string | null;
  referralLink: string | null;
  statistics: ReferralStats;
  rewardHistory: ReferralHistoryItem[];
}

// ─────────────────────────────────────────────────────────────────────────────

function statusLabel(status: string, referrerRewarded: boolean, t: (typeof translations)[keyof typeof translations]) {
  if (status === 'completed' && referrerRewarded) return t.referralScreen.statusCompletedRewarded;
  if (status === 'completed') return t.referralScreen.statusCompleted;
  if (status === 'fraud_flagged') return t.referralScreen.statusRejected;
  return t.referralScreen.statusPending;
}

export default function ReferralScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { get } = useCmsSettings();
  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);

  // ── Data — same two endpoints as the web app ──────────────────────────────

  // 1. Public config: contains referralReferrerCoins, referralRefereeCoins, coinName
  const { data: config, refetch: refetchConfig } = useQuery<LoyaltyConfig>({
    queryKey: ['loyalty-config'],
    queryFn: () => authedFetch('/api/loyalty/config'),
    staleTime: 60_000,
  });

  // 2. Referral-code endpoint: referralCode, referralLink, statistics, rewardHistory
  const { data: referralData, isLoading, refetch: refetchReferral } = useQuery<ReferralData>({
    queryKey: ['loyalty-referral'],
    queryFn: () => authedFetch('/api/loyalty/referral-code'),
    enabled: !!user,
    staleTime: 60_000,
  });

  // 3. Wallet: for lifetimeEarned stat
  const { data: wallet, refetch: refetchWallet } = useQuery<LoyaltyWallet>({
    queryKey: ['wallet'],
    queryFn: () => authedFetch('/api/loyalty/wallet'),
    enabled: !!user,
  });

  useRefetchOnFocus([refetchConfig, refetchReferral, refetchWallet]);

  // ── Derived values ────────────────────────────────────────────────────────

  const referralCode       = referralData?.referralCode ?? '—';
  const referralLink       = referralData?.referralLink ?? '';
  const stats              = referralData?.statistics;
  const history            = referralData?.rewardHistory ?? [];
  const coinName           = config?.coinName ?? t.referralScreen.coinFallback;
  const referrerReward     = config?.referralReferrerCoins ?? 0;
  const refereeReward      = config?.referralRefereeCoins  ?? 0;

  // ── Share ─────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: t.referralScreen.shareMessage(appName, referralCode, coinName, referralLink),
        url: referralLink,
        title: t.referralScreen.shareTitle(appName),
      });
    } catch { }
  };

  // ── Steps ─────────────────────────────────────────────────────────────────

  const steps = [
    { step: t.referralScreen.stepNumbers[0], text: t.referralScreen.step1 },
    { step: t.referralScreen.stepNumbers[1], text: t.referralScreen.step2(appName) },
    { step: t.referralScreen.stepNumbers[2], text: t.referralScreen.step3(refereeReward, coinName) },
    { step: t.referralScreen.stepNumbers[3], text: t.referralScreen.step4(referrerReward, coinName) },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.referralScreen.title} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Feather name="gift" size={40} color="#fff" />
          <Text style={styles.heroTitle}>{t.referralScreen.heroTitle(coinName)}</Text>
          {config?.referralEnabled ? (
            <Text style={styles.heroSub}>
              {t.referralScreen.heroSubYou}
              <Text style={{ fontFamily: 'Cairo_700Bold' }}>{referrerReward}</Text>
              {t.referralScreen.heroSubFriend}
              <Text style={{ fontFamily: 'Cairo_700Bold' }}>{refereeReward}</Text>
              {` ${coinName}`}
            </Text>
          ) : (
            <Text style={styles.heroSub}>{t.referralScreen.heroSubDisabled(appName)}</Text>
          )}
        </View>

        {/* Code box */}
        {isLoading ? (
          <View style={[styles.loadingBox, { backgroundColor: colors.muted }]} />
        ) : referralData?.referralCode ? (
          <View style={styles.section}>
            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>{t.referralScreen.codeLabel}</Text>
            <View style={[styles.codeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{referralCode}</Text>
            </View>

            {/* Referral link */}
            {!!referralLink && (
              <View style={[styles.linkBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.linkText, { color: colors.mutedForeground }]} numberOfLines={1}>{referralLink}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primary }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Feather name="share-2" size={18} color="#fff" />
              <Text style={styles.shareBtnText}>{t.referralScreen.shareBtn}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.section, { alignItems: 'center', paddingVertical: 24 }]}>
            <Feather name="gift" size={32} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
            <Text style={[styles.codeLabel, { color: colors.mutedForeground, marginTop: 8 }]}>{t.referralScreen.noCode}</Text>
          </View>
        )}

        {/* Stats */}
        {stats && (
          <>
            {stats.totalRewardsEarned > 0 && (
              <View style={[styles.earnedCard, { backgroundColor: '#FFF9E6', borderColor: '#F5D478' }]}>
                <Feather name="star" size={20} color="#B7860A" />
                <View>
                  <Text style={styles.earnedLabel}>{t.referralScreen.earnedLabel}</Text>
                  <Text style={styles.earnedValue}>{fmtNumber(stats.totalRewardsEarned)} {coinName}</Text>
                </View>
              </View>
            )}

            <View style={styles.statsGrid}>
              <StatItem label={t.referralScreen.statsTotal} value={stats.total} color={colors} />
              <StatItem label={t.referralScreen.statsPending} value={stats.pending} color={colors} />
              <StatItem label={t.referralScreen.statsCompleted} value={stats.completed} color={colors} />
              <StatItem label={t.referralScreen.statsRejected} value={stats.rejected} color={colors} />
            </View>
          </>
        )}

        {/* Reward history */}
        {history.length > 0 && (
          <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.referralScreen.historyTitle}</Text>
            {history.map((item) => {
              const label = statusLabel(item.status, item.referrerRewarded, t);
              const date = item.rewardedAt ?? item.createdAt;
              return (
                <View key={item.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.historyAvatar, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="user" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={[styles.historyName, { color: colors.foreground }]}>{item.refereeName}</Text>
                    <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                      {fmtDate(date, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.badge, { backgroundColor: item.status === 'completed' ? '#D1FAE5' : item.status === 'fraud_flagged' ? '#FEE2E2' : '#FEF3C7' }]}>
                      <Text style={[styles.badgeText, { color: item.status === 'completed' ? '#065F46' : item.status === 'fraud_flagged' ? '#991B1B' : '#92400E' }]}>{label}</Text>
                    </View>
                    {item.referrerRewarded && referrerReward > 0 && (
                      <Text style={[styles.rewardText, { color: '#059669' }]}>+{referrerReward} {coinName}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* How it works */}
        <View style={[styles.howCard, { backgroundColor: colors.muted + '66', borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.referralScreen.howItWorks}</Text>
          {steps.map(({ step, text }) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.stepNumText, { color: colors.primary }]}>{step}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: any }) {
  return (
    <View style={[styles.statItem, { backgroundColor: color.card, borderColor: color.border }]}>
      <Text style={[styles.statValue, { color: color.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: color.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { margin: 16, borderRadius: 20, padding: 28, alignItems: 'center', gap: 8 },
  heroTitle: { color: '#fff', fontSize: 20, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  heroSub: { color: '#ffffffcc', fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center', lineHeight: 22 },
  loadingBox: { marginHorizontal: 16, height: 160, borderRadius: 16 },
  section: { paddingHorizontal: 16, gap: 12 },
  codeLabel: { fontSize: 13, fontFamily: 'Cairo_500Medium', textAlign: 'center' },
  codeBox: { borderRadius: 14, borderWidth: 2, padding: 18, alignItems: 'center', borderStyle: 'dashed' },
  codeText: { fontSize: 28, fontFamily: 'Cairo_700Bold', letterSpacing: 4 },
  linkBox: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  linkText: { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'auto' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, gap: 8 },
  shareBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Cairo_700Bold' },
  earnedCard: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  earnedLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: '#92400E' },
  earnedValue: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: '#92400E' },
  statsGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  statItem: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  historyCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  sectionTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', textAlign: 'auto', marginBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  historyAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  historyContent: { flex: 1, alignItems: 'flex-end' },
  historyName: { fontSize: 14, fontFamily: 'Cairo_500Medium' },
  historyDate: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  rewardText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  howCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  stepNumText: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  stepText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 22, textAlign: 'auto' },
});
