/**
 * Customer Wallet — matches website wallet.tsx layout exactly.
 * Issue #4: Redesigned to match web version.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { fmtDate } from '@/lib/fmt';
import { router } from 'expo-router';
import type { LoyaltyWallet, CoinTransaction } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

// ── Credit transaction types (mirrors website CREDIT_TYPES set) ──────────────
const CREDIT_TYPES = new Set([
  'earn_pending', 'earn_available', 'referral_bonus', 'campaign',
  'manual_credit', 'redeem_reversal', 'credit', 'release', 'referral', 'admin',
]);

function txnSign(type: string): string  { return CREDIT_TYPES.has(type) ? '+' : '−'; }
function txnColor(type: string): string {
  if (CREDIT_TYPES.has(type)) return '#16A34A';
  if (type === 'expire' || type === 'expiry') return '#EA580C';
  return '#EF4444';
}


/** Days until a date. Returns null if date is in the past. */
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function CustomerWalletScreen() {
  const { locale, isRTL } = useLocale();
  const t = translations[locale];
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const [txPage, setTxPage] = useState(1);

  const TXN_LABEL: Record<string, string> = {
    earn_pending:    t.customerWallet.txEarnPending,
    earn_available:  t.customerWallet.txEarnAvailable,
    redeem:          t.customerWallet.txRedeem,
    expire:          t.customerWallet.txExpire,
    expiry:          t.customerWallet.txExpire,
    referral:        t.customerWallet.txReferral,
    referral_bonus:  t.customerWallet.txReferral,
    admin:           t.customerWallet.txAdmin,
    manual_credit:   t.customerWallet.txAdmin,
    campaign:        t.customerWallet.txCampaign,
    cancel:          t.customerWallet.txCancel,
    redeem_reversal: t.customerWallet.txRedeemReversal,
    credit:          t.customerWallet.txCredit,
  };

  const { data: wallet, isLoading: wLoading, refetch: rW } = useQuery<LoyaltyWallet>({
    queryKey: ['wallet'],
    queryFn: () => authedFetch('/api/loyalty/wallet'),
    enabled: !!user,
  });

  const { data: loyaltyConfig } = useQuery<any>({
    queryKey: ['loyalty-config'],
    queryFn: () => authedFetch('/api/loyalty/config'),
    staleTime: 120_000,
  });

  const { data: txnEnvelope, isLoading: tLoading, refetch: rT, isRefetching } = useQuery<any>({
    queryKey: ['coin-transactions', txPage],
    queryFn: () =>
      authedFetch(`/api/loyalty/transactions?limit=20&page=${txPage}`)
        .catch(() => ({ transactions: [], totalPages: 1 })),
    enabled: !!user,
  });

  useRefetchOnFocus([rW, rT]);
  const handleRefresh = () => { rW(); rT(); };

  const w = wallet as any;
  const transactions: CoinTransaction[] = txnEnvelope?.transactions ?? [];
  const totalPages: number = txnEnvelope?.totalPages ?? 1;

  const coinName    = loyaltyConfig?.coinName    ?? t.referralScreen.coinFallback;
  const coinRedeemX = loyaltyConfig?.coinRedeemX ?? 1;
  const coinRedeemY = loyaltyConfig?.coinRedeemY ?? 0.5;

  const availableCoins: number  = w?.availableCoins   ?? 0;
  const pendingCoins: number    = w?.pendingCoins      ?? 0;
  const reservedCoins: number   = w?.reservedCoins     ?? 0;
  const lifetimeEarned: number  = w?.lifetimeEarned    ?? 0;
  const lifetimeUsed: number    = w?.lifetimeUsed      ?? 0;
  const approxDiscount: number  = w?.approximateDiscountValue ?? 0;

  // Next expiration from wallet
  const nextExp     = w?.nextExpiration as { amount: number; expiresAt: string } | null | undefined;
  const nextExpDays = nextExp ? daysUntil(nextExp?.expiresAt) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.customerWallet.title} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32, padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {wLoading ? (
          <SkeletonList count={4} height={90} />
        ) : (
          <>
            {/* ── Main balance card (full width) ─────────────────────── */}
            <LinearGradient
              colors={['#FFFBEB', '#FEF3C7', '#FDE68A55']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainCard}
            >
               <View style={styles.mainCardRow}>
                 {isRTL ? (
                   <>
                     <View style={styles.mainCardRight}>
                       <Text style={styles.mainCardLabel}>{t.customerWallet.availableBalance}</Text>
                       <Text style={styles.mainCardValue}>{availableCoins.toLocaleString('en-US')}</Text>
                       <Text style={styles.mainCardCoin}>{coinName}</Text>
                     </View>
                     <View style={styles.mainCardLeft}>
                       <Text style={styles.mainCardApproxLabel}>{t.customerWallet.approxLabel}</Text>
                       <Text style={styles.mainCardApproxValue}>{approxDiscount.toFixed(2)} {t.common.currency}</Text>
                       <Text style={styles.mainCardApproxSub}>{t.customerWallet.approxSub}</Text>
                     </View>
                   </>
                 ) : (
                   <>
                     <View style={styles.mainCardLeft}>
                       <Text style={styles.mainCardApproxLabel}>{t.customerWallet.approxLabel}</Text>
                       <Text style={styles.mainCardApproxValue}>{approxDiscount.toFixed(2)} {t.common.currency}</Text>
                       <Text style={styles.mainCardApproxSub}>{t.customerWallet.approxSub}</Text>
                     </View>
                     <View style={styles.mainCardRight}>
                       <Text style={styles.mainCardLabel}>{t.customerWallet.availableBalance}</Text>
                       <Text style={styles.mainCardValue}>{availableCoins.toLocaleString('en-US')}</Text>
                       <Text style={styles.mainCardCoin}>{coinName}</Text>
                     </View>
                   </>
                 )}
               </View>
            </LinearGradient>

            {/* ── Two secondary cards: Pending + Reserved ─────────────── */}
            <View style={styles.twoCardsRow}>
              {/* Pending */}
               <View style={[styles.smallCard, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
                 {isRTL ? (
                   <>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#1E40AF' }]}>{t.customerWallet.pendingLabel}</Text>
                       <Text style={[styles.smallCardValue, { color: '#1E3A8A' }]}>{pendingCoins.toLocaleString('en-US')}</Text>
                     </View>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#DBEAFE' }]}>
                       <Feather name="clock" size={18} color="#2563EB" />
                     </View>
                   </>
                 ) : (
                   <>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#DBEAFE' }]}>
                       <Feather name="clock" size={18} color="#2563EB" />
                     </View>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#1E40AF' }]}>{t.customerWallet.pendingLabel}</Text>
                       <Text style={[styles.smallCardValue, { color: '#1E3A8A' }]}>{pendingCoins.toLocaleString('en-US')}</Text>
                     </View>
                   </>
                 )}
              </View>

              {/* Reserved */}
               <View style={[styles.smallCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                 {isRTL ? (
                   <>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#C2410C' }]}>{t.customerWallet.reservedLabel}</Text>
                       <Text style={[styles.smallCardValue, { color: '#9A3412' }]}>{reservedCoins.toLocaleString('en-US')}</Text>
                     </View>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#FFEDD5' }]}>
                       <Feather name="lock" size={18} color="#EA580C" />
                     </View>
                   </>
                 ) : (
                   <>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#FFEDD5' }]}>
                       <Feather name="lock" size={18} color="#EA580C" />
                     </View>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#C2410C' }]}>{t.customerWallet.reservedLabel}</Text>
                       <Text style={[styles.smallCardValue, { color: '#9A3412' }]}>{reservedCoins.toLocaleString('en-US')}</Text>
                     </View>
                   </>
                 )}
              </View>
            </View>

            {/* ── Expiration alert ──────────────────────────────────────── */}
            {nextExp && nextExpDays !== null && (
               <View style={styles.expiryCard}>
                 {isRTL ? (
                   <>
                     <View style={{ flex: 1 }}>
                       <Text style={styles.expiryTitle}>{t.customerWallet.expiryTitle}</Text>
                       <Text style={styles.expiryBody}>
                         <Text style={{ fontFamily: 'Cairo_700Bold' }}>{nextExp.amount.toLocaleString('en-US')}</Text>
                         {' '}{coinName} — {t.customerWallet.expiryIn}{' '}
                         <Text style={{ fontFamily: 'Cairo_700Bold' }}>{nextExpDays}</Text>
                         {' '}{nextExpDays === 1 ? t.customerWallet.daySuffix : t.customerWallet.daysSuffix}
                       </Text>
                       <Text style={styles.expiryHint}>{t.customerWallet.expiryHint}</Text>
                     </View>
                     <View style={[styles.expiryIcon, { backgroundColor: '#FFEDD5' }]}>
                       <Feather name="alert-triangle" size={18} color="#EA580C" />
                     </View>
                   </>
                 ) : (
                   <>
                     <View style={[styles.expiryIcon, { backgroundColor: '#FFEDD5' }]}>
                       <Feather name="alert-triangle" size={18} color="#EA580C" />
                     </View>
                     <View style={{ flex: 1 }}>
                       <Text style={styles.expiryTitle}>{t.customerWallet.expiryTitle}</Text>
                       <Text style={styles.expiryBody}>
                         <Text style={{ fontFamily: 'Cairo_700Bold' }}>{nextExp.amount.toLocaleString('en-US')}</Text>
                         {' '}{coinName} — {t.customerWallet.expiryIn}{' '}
                         <Text style={{ fontFamily: 'Cairo_700Bold' }}>{nextExpDays}</Text>
                         {' '}{nextExpDays === 1 ? t.customerWallet.daySuffix : t.customerWallet.daysSuffix}
                       </Text>
                       <Text style={styles.expiryHint}>{t.customerWallet.expiryHint}</Text>
                     </View>
                   </>
                 )}
              </View>
            )}

            {/* ── Lifetime stats ────────────────────────────────────────── */}
            <View style={styles.twoCardsRow}>
              {/* Earned */}
               <View style={[styles.smallCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                 {isRTL ? (
                   <>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#166534' }]}>{t.customerWallet.earnedTotal}</Text>
                       <Text style={[styles.smallCardValue, { color: '#14532D' }]}>{lifetimeEarned.toLocaleString('en-US')}</Text>
                     </View>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#DCFCE7' }]}>
                       <Feather name="trending-up" size={18} color="#16A34A" />
                     </View>
                   </>
                 ) : (
                   <>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#DCFCE7' }]}>
                       <Feather name="trending-up" size={18} color="#16A34A" />
                     </View>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#166534' }]}>{t.customerWallet.earnedTotal}</Text>
                       <Text style={[styles.smallCardValue, { color: '#14532D' }]}>{lifetimeEarned.toLocaleString('en-US')}</Text>
                     </View>
                   </>
                 )}
              </View>

              {/* Used */}
               <View style={[styles.smallCard, { backgroundColor: '#FAF5FF', borderColor: '#D8B4FE' }]}>
                 {isRTL ? (
                   <>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#7E22CE' }]}>{t.customerWallet.usedTotal}</Text>
                       <Text style={[styles.smallCardValue, { color: '#581C87' }]}>{lifetimeUsed.toLocaleString('en-US')}</Text>
                     </View>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#F3E8FF' }]}>
                       <Feather name="gift" size={18} color="#9333EA" />
                     </View>
                   </>
                 ) : (
                   <>
                     <View style={[styles.smallCardIcon, { backgroundColor: '#F3E8FF' }]}>
                       <Feather name="gift" size={18} color="#9333EA" />
                     </View>
                     <View style={styles.smallCardText}>
                       <Text style={[styles.smallCardLabel, { color: '#7E22CE' }]}>{t.customerWallet.usedTotal}</Text>
                       <Text style={[styles.smallCardValue, { color: '#581C87' }]}>{lifetimeUsed.toLocaleString('en-US')}</Text>
                     </View>
                   </>
                 )}
              </View>
            </View>

            {/* ── Program info ──────────────────────────────────────────── */}
            {loyaltyConfig && (
              <View style={[styles.infoCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>{t.customerWallet.programInfo}</Text>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {t.customerWallet.conversionRateValue(coinRedeemX, coinName, coinRedeemY)}
                  </Text>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t.customerWallet.conversionRate}</Text>
                </View>
                {loyaltyConfig.maxCoinsPerRequest && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>
                      {loyaltyConfig.maxCoinsPerRequest.toLocaleString('en-US')} {coinName}
                    </Text>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t.customerWallet.maxPerRequest}</Text>
                  </View>
                )}
                {loyaltyConfig.minRequestValue && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>
                      {loyaltyConfig.minRequestValue} {t.common.currency}
                    </Text>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t.customerWallet.minRequestValue}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Referral link ─────────────────────────────────────────── */}
            {loyaltyConfig?.referralEnabled && (
              <TouchableOpacity
                style={[styles.referralRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push('/referral' as any)}
                activeOpacity={0.8}
              >
                <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.referralTitle, { color: colors.foreground }]}>{t.customerWallet.referralTitle}</Text>
                  <Text style={[styles.referralSub, { color: colors.mutedForeground }]}>
                    {t.customerWallet.referralInvite(loyaltyConfig.referralReferrerCoins, coinName)}
                  </Text>
                </View>
                <View style={[styles.referralIcon, { backgroundColor: colors.primary + '18' }]}>
                  <Feather name="gift" size={18} color={colors.primary} />
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Transactions ─────────────────────────────────────────────── */}
        <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.txTitle, { color: colors.foreground }]}>{t.customerWallet.txTitle}</Text>

          {tLoading ? (
            <SkeletonList count={3} height={64} />
          ) : transactions.length === 0 ? (
            <EmptyState icon="star" title={t.customerWallet.emptyTitle} subtitle={t.customerWallet.emptySubtitle} />
          ) : (
            <>
              {transactions.map((tx: any) => {
                const label   = TXN_LABEL[tx.type] ?? tx.type;
                const expDate = tx.expiresAt ?? null;
                const expDays = daysUntil(expDate);
                const isEarning = CREDIT_TYPES.has(tx.type) && !!expDate;
                const isExpired = expDate && new Date(expDate) <= new Date();

                return (
                  <View
                    key={tx.id}
                    style={[styles.txRow, { borderBottomColor: colors.border + '60' }]}
                  >
                     {isRTL ? (
                       <>
                         {/* Icon + complete information block on the RIGHT; amount on the LEFT */}
                         <View style={[styles.txIcon, { backgroundColor: colors.muted }]}>
                           <Feather
                             name={CREDIT_TYPES.has(tx.type) ? 'arrow-down-circle' : tx.type === 'expire' || tx.type === 'expiry' ? 'alert-triangle' : 'arrow-up-circle'}
                             size={16}
                             color={txnColor(tx.type)}
                           />
                         </View>
                         <View style={styles.txDesc}>
                           {/* Title row: description + optional "ملغي" badge */}
                           <View style={styles.txDescRow}>
                             <Text style={[styles.txDescText, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>
                               {tx.description || label}
                             </Text>
                             {tx.cancelled && (
                               <View style={styles.cancelledBadge}>
                                 <Text style={styles.cancelledBadgeText}>{t.customerWallet.cancelledBadge}</Text>
                               </View>
                             )}
                           </View>
                           <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                             {fmtDate(tx.createdAt)}
                           </Text>
                           {isEarning && expDate && (
                             isExpired ? (
                               <View style={styles.expiredBadge}>
                                 <Text style={styles.expiredBadgeText}>{t.customerWallet.expiredBadge}</Text>
                               </View>
                             ) : expDays !== null ? (
                               <Text style={[styles.txExpiry, { color: expDays <= 7 ? '#EA580C' : colors.mutedForeground }]}>
                                 {t.customerWallet.expiresIn(expDays)}
                               </Text>
                             ) : (
                               <Text style={[styles.txExpiry, { color: colors.mutedForeground }]}>
                                 {t.customerWallet.expiresOn} {new Date(expDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                               </Text>
                             )
                           )}
                         </View>
                         <View style={styles.txAmountCol}>
                           <Text style={[styles.txAmount, { color: txnColor(tx.type) }]}>
                             {txnSign(tx.type)}{Math.abs(tx.amount).toLocaleString('en-US')}
                           </Text>
                           {tx.balanceAfter != null && (
                             <Text style={[styles.txBalance, { color: colors.mutedForeground }]}>
                               {t.customerWallet.txBalancePrefix} {tx.balanceAfter}
                             </Text>
                           )}
                         </View>
                       </>
                     ) : (
                       <>
                         <View style={styles.txAmountCol}>
                           <Text style={[styles.txAmount, { color: txnColor(tx.type) }]}>
                             {txnSign(tx.type)}{Math.abs(tx.amount).toLocaleString('en-US')}
                           </Text>
                           {tx.balanceAfter != null && (
                             <Text style={[styles.txBalance, { color: colors.mutedForeground }]}>
                               {t.customerWallet.txBalancePrefix} {tx.balanceAfter}
                             </Text>
                           )}
                         </View>
                         <View style={[styles.txIcon, { backgroundColor: colors.muted }]}>
                           <Feather
                             name={CREDIT_TYPES.has(tx.type) ? 'arrow-down-circle' : tx.type === 'expire' || tx.type === 'expiry' ? 'alert-triangle' : 'arrow-up-circle'}
                             size={16}
                             color={txnColor(tx.type)}
                           />
                         </View>
                         <View style={styles.txDesc}>
                           {/* Title row: description + optional "ملغي" badge */}
                           <View style={styles.txDescRow}>
                             <Text style={[styles.txDescText, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>
                               {tx.description || label}
                             </Text>
                             {tx.cancelled && (
                               <View style={styles.cancelledBadge}>
                                 <Text style={styles.cancelledBadgeText}>{t.customerWallet.cancelledBadge}</Text>
                               </View>
                             )}
                           </View>
                           <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                             {fmtDate(tx.createdAt)}
                           </Text>
                           {isEarning && expDate && (
                             isExpired ? (
                               <View style={styles.expiredBadge}>
                                 <Text style={styles.expiredBadgeText}>{t.customerWallet.expiredBadge}</Text>
                               </View>
                             ) : expDays !== null ? (
                               <Text style={[styles.txExpiry, { color: expDays <= 7 ? '#EA580C' : colors.mutedForeground }]}>
                                 {t.customerWallet.expiresIn(expDays)}
                               </Text>
                             ) : (
                               <Text style={[styles.txExpiry, { color: colors.mutedForeground }]}>
                                 {t.customerWallet.expiresOn} {new Date(expDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                               </Text>
                             )
                           )}
                         </View>
                       </>
                     )}
                  </View>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: colors.muted, opacity: txPage >= totalPages ? 0.4 : 1 }]}
                    disabled={txPage >= totalPages}
                    onPress={() => setTxPage(p => p + 1)}
                  >
                    <Text style={[styles.pageBtnText, { color: colors.foreground }]}>{t.customerWallet.navNext}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.pageInfo, { color: colors.mutedForeground }]}>
                    {txPage} / {totalPages}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: colors.muted, opacity: txPage <= 1 ? 0.4 : 1 }]}
                    disabled={txPage <= 1}
                    onPress={() => setTxPage(p => p - 1)}
                  >
                    <Text style={[styles.pageBtnText, { color: colors.foreground }]}>{t.customerWallet.navPrev}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Main balance card
  mainCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  mainCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainCardRight: { alignItems: 'flex-end' },
  mainCardLeft:  { alignItems: 'flex-start' },
  mainCardLabel: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: '#92400E', marginBottom: 2 },
  mainCardValue: { fontSize: 36, fontFamily: 'Cairo_700Bold', color: '#78350F' },
  mainCardCoin:  { fontSize: 13, fontFamily: 'Cairo_400Regular', color: '#92400E' },
  mainCardApproxLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: '#92400E', opacity: 0.8 },
  mainCardApproxValue: { fontSize: 22, fontFamily: 'Cairo_700Bold', color: '#16A34A' },
  mainCardApproxSub:   { fontSize: 11, fontFamily: 'Cairo_400Regular', color: '#6B7280' },

  // Two-column card row
  twoCardsRow: { flexDirection: 'row', gap: 12 },
  smallCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallCardIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  smallCardText: { flex: 1, alignItems: 'flex-end' },
  smallCardLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  smallCardValue: { fontSize: 18, fontFamily: 'Cairo_700Bold' },

  // Expiration alert
  expiryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 14,
    padding: 14,
  },
  expiryIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  expiryTitle: { fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#C2410C', textAlign: 'auto' },
  expiryBody:  { fontSize: 12, fontFamily: 'Cairo_400Regular', color: '#9A3412', textAlign: 'auto', marginTop: 2 },
  expiryHint:  { fontSize: 11, fontFamily: 'Cairo_400Regular', color: '#EA580C', textAlign: 'auto', marginTop: 2 },

  // Program info
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  infoTitle: { fontSize: 14, fontFamily: 'Cairo_700Bold', textAlign: 'auto', marginBottom: 4 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  infoValue:  { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },

  // Referral
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  referralIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  referralTitle: { fontSize: 14, fontFamily: 'Cairo_700Bold', textAlign: 'auto' },
  referralSub:   { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'auto' },

  // Transactions card
  txCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  txTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', textAlign: 'auto', marginBottom: 12 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  txIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  txDesc: { flex: 1, alignItems: 'flex-end', gap: 2 },
  txDescText: { fontSize: 13, fontFamily: 'Cairo_500Medium', textAlign: 'auto' },
  txDate:     { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  txExpiry:   { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  txAmountCol: { alignItems: 'flex-start', gap: 2 },
  txAmount:   { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  txBalance:  { fontSize: 10, fontFamily: 'Cairo_400Regular' },
  txDescRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelledBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0,
  },
  cancelledBadgeText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold', color: '#DC2626' },
  expiredBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-end', marginTop: 2,
  },
  expiredBadgeText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold', color: '#EF4444' },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 4,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pageBtnText: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
  pageInfo: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
