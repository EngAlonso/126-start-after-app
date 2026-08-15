import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { PointsBalance, PointTransaction } from '@/types';

// ─── Transaction metadata ──────────────────────────────────────────────────────
type TxnMeta = { label: string; positive: boolean; color: string; bg: string; icon: keyof typeof Feather.glyphMap };
const TXN_DEFAULT: TxnMeta = { label: '—', positive: false, color: '#6B7280', bg: '#F9FAFB', icon: 'circle' };

// ─── Filter type ──────────────────────────────────────────────────────────────
type Filter = 'all' | 'credit' | 'debit' | 'commission' | 'release';

export default function TechnicianWalletScreen() {
  const colors      = useColors();
  const { isDark }  = useTheme();
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const authedFetch = useAuthedFetch();
  const [filter, setFilter] = useState<Filter>('all');
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  // ── Transaction metadata (label from translations) ──────────────────────────
  const TXN_META: Record<string, TxnMeta> = {
    credit:     { label: t.techWallet.txCreditLabel,     positive: true,  color: '#16A34A', bg: '#F0FDF4', icon: 'trending-up'   },
    debit:      { label: t.techWallet.txDebitLabel,      positive: false, color: '#DC2626', bg: '#FEF2F2', icon: 'trending-down' },
    commission: { label: t.techWallet.txCommissionLabel, positive: false, color: '#D97706', bg: '#FFF7ED', icon: 'lock'          },
    release:    { label: t.techWallet.txReleaseLabel,    positive: true,  color: '#2563EB', bg: '#EFF6FF', icon: 'rotate-ccw'    },
  };

  // ── Filter chips (label from translations) ──────────────────────────────────
  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',        label: t.techWallet.filterAll         },
    { key: 'credit',     label: t.techWallet.filterAdded       },
    { key: 'debit',      label: t.techWallet.filterDeducted    },
    { key: 'commission', label: t.techWallet.filterCommissions },
    { key: 'release',    label: t.techWallet.filterReturned    },
  ];

  const { data: points, isLoading: ptLoading, refetch: rP } = useQuery<PointsBalance>({
    queryKey: ['points-balance'],
    queryFn:  () => authedFetch('/api/points/balance'),
    enabled:  !!user,
  });

  const { data: transactions = [], isLoading: txLoading, refetch: rT, isRefetching } = useQuery<PointTransaction[]>({
    queryKey: ['point-transactions'],
    queryFn:  () => authedFetch('/api/points/transactions?limit=50'),
    enabled:  !!user,
  });

  useRefetchOnFocus([rP, rT]);
  const handleRefresh = () => { rP(); rT(); };

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalBalance   = points?.balance        ?? 0;
  const reservedPoints = points?.reservedPoints ?? 0;
  const available      = points?.available      ?? Math.max(0, totalBalance - reservedPoints);
  const lowPoints      = available < 200;

  const allTxns  = Array.isArray(transactions) ? transactions : [];
  const filtered = filter === 'all' ? allTxns : allTxns.filter(tx => tx.type === filter);

  const totalAdded      = allTxns.filter(tx => tx.type === 'credit')     .reduce((s, tx) => s + tx.amount, 0);
  const totalDeducted   = allTxns.filter(tx => tx.type === 'debit')      .reduce((s, tx) => s + tx.amount, 0);
  const totalCommission = allTxns.filter(tx => tx.type === 'commission') .reduce((s, tx) => s + tx.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="technician" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TECH_TAB_BAR_HEIGHT + insets.bottom + 24 }}
      >

        {/* ── Two balance cards (side by side) ────────────────────────────── */}
        <View style={styles.balanceRow}>

          {/* Available points */}
          <LinearGradient
            colors={isDark
              ? (lowPoints ? ['#2D1E00', '#1A1000'] : ['#1A1500', '#201C00'])
              : (lowPoints ? ['#FEF3C7', '#FFFBEB'] : ['#FEF9EC', '#FFFDF5'])}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.balanceCard, {
              borderColor: lowPoints ? '#FCD34D' : '#E9B73A33',
              shadowColor: '#E9B73A',
            }]}
          >
            <View style={[styles.balanceIcon, { backgroundColor: isDark ? '#E9B73A30' : '#E9B73A20' }]}>
              <Feather name="pocket" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.balanceNum, { color: isDark ? '#E9B73A' : '#92400E' }]}>
              {ptLoading ? '—' : fmtNumber(available)}
            </Text>
            <Text style={[styles.balanceSub, { color: isDark ? '#D97706' : colors.mutedForeground }]}>{t.techWallet.availablePoints}</Text>
            <Text style={[styles.balanceHint, { color: isDark ? '#B45309' : colors.mutedForeground }]}>{t.techWallet.readyToUse}</Text>
            {lowPoints && (
              <View style={styles.lowBadge}>
                <Feather name="alert-triangle" size={11} color="#D97706" />
                <Text style={styles.lowBadgeText}>{t.techWallet.lowBalance}</Text>
              </View>
            )}
          </LinearGradient>

          {/* Reserved points */}
          <LinearGradient
            colors={isDark ? ['#2A1708', '#1C1008'] : ['#FFF7ED', '#FFFBF5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.balanceCard, {
              borderColor: isDark ? '#D977064D' : '#FED7AA',
              shadowColor: '#D97706',
            }]}
          >
            <View style={[styles.balanceIcon, { backgroundColor: '#FED7AA60' }]}>
              <Feather name="lock" size={26} color="#D97706" />
            </View>
            <Text style={[styles.balanceNum, { color: isDark ? '#FDBA74' : '#92400E' }]}>
              {ptLoading ? '—' : fmtNumber(reservedPoints)}
            </Text>
            <Text style={[styles.balanceSub, { color: isDark ? '#F59E0B' : '#D97706' }]}>{t.techWallet.reservedPoints}</Text>
            <Text style={[styles.balanceHint, { color: isDark ? '#D97706' : '#B45309' }]}>{t.techWallet.forPendingOffers}</Text>
          </LinearGradient>

        </View>

        {/* Total balance line */}
        <Text style={[styles.totalLine, { color: colors.mutedForeground }]}>
          {t.techWallet.totalBalanceLabel}{' '}
          <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.foreground }}>
            {fmtNumber(totalBalance)}
          </Text>
          {' '}{t.techWallet.totalBalanceSuffix}
        </Text>

        {/* ── Three stats mini-cards ────────────────────────────────────────── */}
        <View style={[styles.statsRow, { direction: isRTL ? 'rtl' : 'ltr' }] as any}>
          {isRTL ? (
            <>
              <StatCard icon="lock"          value={`-${fmtNumber(totalCommission)}`} label={t.techWallet.filterCommissions} color="#D97706" bg="#FFF7ED" border="#FED7AA" />
              <StatCard icon="trending-up"   value={`+${fmtNumber(totalAdded)}`}      label={t.techWallet.filterAdded}       color="#16A34A" bg="#F0FDF4" border="#BBF7D0" />
              <StatCard icon="trending-down" value={`-${fmtNumber(totalDeducted)}`}   label={t.techWallet.filterDeducted}    color="#DC2626" bg="#FEF2F2" border="#FECACA" />
            </>
          ) : (
            <>
              <StatCard icon="trending-up"   value={`+${fmtNumber(totalAdded)}`}      label={t.techWallet.filterAdded}       color="#16A34A" bg="#F0FDF4" border="#BBF7D0" />
              <StatCard icon="trending-down" value={`-${fmtNumber(totalDeducted)}`}   label={t.techWallet.filterDeducted}    color="#DC2626" bg="#FEF2F2" border="#FECACA" />
              <StatCard icon="lock"          value={`-${fmtNumber(totalCommission)}`} label={t.techWallet.filterCommissions} color="#D97706" bg="#FFF7ED" border="#FED7AA" />
            </>
          )}
        </View>

        {/* ── Info box ──────────────────────────────────────────────────────── */}
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border, direction: isRTL ? 'rtl' : 'ltr' }] as any}>
          {isRTL ? (
            <>
              <Text style={[styles.infoText, { color: colors.foreground, textAlign: 'right' }]}>
                {t.techWallet.infoText}
              </Text>
              <Feather name="info" size={16} color={colors.primary} />
            </>
          ) : (
            <>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground, textAlign: 'left' }]}>
                {t.techWallet.infoText}
              </Text>
            </>
          )}
        </View>

        {/* ── Transactions section ──────────────────────────────────────────── */}
        <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Header: title + filter chips */}
          <View style={styles.txHeader}>
            <Text style={[styles.txTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{t.techWallet.txTitle}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[
                      styles.chip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : colors.mutedForeground }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Body */}
          {txLoading ? (
            <View style={{ padding: 16 }}>
              <SkeletonList count={5} height={68} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ paddingVertical: 32 }}>
              <EmptyState icon="list" title={t.techWallet.noTx} subtitle="" />
            </View>
          ) : (
            <View style={styles.txList}>
              {filtered.map(tx => {
                const meta = TXN_META[tx.type] ?? TXN_DEFAULT;
                return (
                  <View key={tx.id} style={[styles.txRow, { borderColor: colors.border }, isRTL && styles.rtlTxRow] as any}>
                    {isRTL ? (
                      <>
                        <View style={[styles.txRight, { alignItems: 'flex-start' }]}>
                          <Text style={[styles.txAmount, { color: meta.color }]}>
                            {meta.positive ? '+' : '-'}{fmtNumber(Math.abs(tx.amount))}
                          </Text>
                        </View>
                        <View style={[styles.txMeta, { alignItems: 'flex-end' }]}>
                          <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                            {meta.label}
                          </Text>
                          <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                            {fmtDate(tx.createdAt)}
                          </Text>
                          <Text style={[styles.txBalance, { color: colors.mutedForeground }]}>
                            {t.techWallet.txBalanceLabel} {fmtNumber(tx.balanceAfter)}
                          </Text>
                        </View>
                        <View style={[styles.txIconWrap, { backgroundColor: meta.bg }]}>
                          <Feather name={meta.icon} size={16} color={meta.color} />
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={[styles.txIconWrap, { backgroundColor: meta.bg }]}>
                          <Feather name={meta.icon} size={16} color={meta.color} />
                        </View>
                        <View style={[styles.txMeta, { alignItems: 'flex-start' }]}>
                          <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                            {meta.label}
                          </Text>
                          <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                            {fmtDate(tx.createdAt)}
                          </Text>
                        </View>
                        <View style={[styles.txRight, { alignItems: 'flex-end' }]}>
                          <Text style={[styles.txAmount, { color: meta.color }]}>
                            {meta.positive ? '+' : '-'}{fmtNumber(Math.abs(tx.amount))}
                          </Text>
                          <Text style={[styles.txBalance, { color: colors.mutedForeground }]}>
                            {t.techWallet.txBalanceLabel} {fmtNumber(tx.balanceAfter)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Stats mini-card ──────────────────────────────────────────────────────────
function StatCard({
  icon, value, label, color, bg, border,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string; label: string; color: string; bg: string; border: string;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: bg, borderColor: border }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 6,
    alignItems: 'center', gap: 4,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  value: { fontSize: 18, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  label: { fontSize: 11, fontFamily: 'Cairo_500Medium', textAlign: 'center', opacity: 0.85 },
});

// ─── Main stylesheet ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  balanceRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  balanceCard: {
    flex: 1, minHeight: 214, borderRadius: 22, borderWidth: 1.5, padding: 20,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
  },
  balanceIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  balanceNum:  { fontSize: 36, fontFamily: 'Cairo_700Bold', lineHeight: 44, includeFontPadding: false },
  balanceSub:  { fontSize: 12, fontFamily: 'Cairo_600SemiBold', textAlign: 'center' },
  balanceHint: { fontSize: 10, fontFamily: 'Cairo_400Regular', textAlign: 'center', opacity: 0.8 },
  lowBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  lowBadgeText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold', color: '#D97706' },

  totalLine: { textAlign: 'center', fontSize: 12, fontFamily: 'Cairo_400Regular', marginBottom: 14, marginHorizontal: 16 },

  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },

  infoBox: {
    marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 22 },

  txCard: {
    marginHorizontal: 16, borderRadius: 20, borderWidth: 1,
    // NOTE: no overflow:'hidden' — elevation + overflow:'hidden' = white rectangle on Android
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  txHeader:     { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 10 },
  txTitle:      { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  filterChips:  { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  chip:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipText:     { fontSize: 12, fontFamily: 'Cairo_500Medium' },
  divider:      { height: 1, marginHorizontal: 16, opacity: 0.6 },
  txList:       { padding: 12, gap: 8 },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 12, gap: 10, backgroundColor: 'transparent',
  },
  rtlTxRow: { direction: 'ltr' },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txMeta:     { flex: 1, alignItems: 'flex-end', gap: 2 },
  txDesc:     { fontSize: 14, fontFamily: 'Cairo_500Medium' },
  txDate:     { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  txRight:    { alignItems: 'flex-start', gap: 2, minWidth: 56 },
  txAmount:   { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  txBalance:  { fontSize: 10, fontFamily: 'Cairo_400Regular' },
});
