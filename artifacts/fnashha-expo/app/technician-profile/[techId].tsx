import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { Feather } from '@expo/vector-icons';
import { StarRating } from '@/components/StarRating';
import { useColors } from '@/hooks/useColors';
import { useAuthedFetch, resolveMediaUrl } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonList } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { fmtDate } from '@/lib/fmt';
import type { Rating } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

export default function TechnicianProfileScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const { techId } = useLocalSearchParams<{ techId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const authedFetch = useAuthedFetch();

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ['tech-public-profile', techId],
    queryFn: () => authedFetch(`/api/technicians/${techId}/public-profile`),
    enabled: !!techId,
    staleTime: 3 * 60 * 1000,
  });

  const ratings: Rating[]  = profile?.reviews ?? [];
  // API may return averageRating / totalRatings / completedJobs as strings, numbers,
  // null, or undefined. Parse through Number() and guard with isFinite everywhere.
  const avgRating: number  = (() => { const v = Number(profile?.averageRating); return isFinite(v) ? v : 0; })();
  const totalRatings       = (() => { const v = Number(profile?.reviewCount ?? ratings.length); return isFinite(v) && v >= 0 ? Math.round(v) : 0; })();
  const fullName: string   = profile?.fullName      ?? t.techPublicProfile.techFallback;
  const profileImage       = profile?.profileImage  ?? null;
  const completedJobs      = (() => { const v = Number(profile?.completedJobs); return isFinite(v) && v >= 0 ? Math.round(v) : 0; })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.techPublicProfile.screenTitle} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ padding: 16 }}><SkeletonList count={5} /></View>
        ) : (
          <>
            {/* ── Hero card ── */}
            <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
              {/* Amber accent strip */}
              <View style={[styles.heroAccent, { backgroundColor: colors.primary }]} />

              <View style={styles.heroBody}>
                {/* Avatar */}
                {resolveMediaUrl(profileImage) ? (
                  <Image
                    source={{ uri: resolveMediaUrl(profileImage)! }}
                    style={styles.heroAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.heroAvatarFallback, { backgroundColor: colors.primary + '22' }]}>
                    <Feather name="user" size={44} color={colors.primary} />
                  </View>
                )}

                {/* Name + rating */}
                <Text style={[styles.heroName, { color: colors.foreground }]}>{fullName}</Text>

                <View style={{ alignItems: 'center', gap: 4 }}>
                  <StarRating value={avgRating} size={18} />
                  <Text style={[styles.heroRatingText, { color: colors.foreground }]}>
                    {avgRating ? avgRating.toFixed(1) : '—'}
                    <Text style={[styles.heroTotalText, { color: colors.mutedForeground }]}>
                      {' '}({totalRatings} {t.techPublicProfile.ratingLabel})
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Stats strip */}
              <View style={[styles.statsStrip, { borderTopColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{totalRatings}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t.techPublicProfile.ratingLabel}</Text>
                </View>
                <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {avgRating ? avgRating.toFixed(1) : '—'}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t.techPublicProfile.avgRatingLabel}</Text>
                </View>
                {completedJobs > 0 && (
                  <>
                    <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.primary }]}>{completedJobs}</Text>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t.techPublicProfile.completedLabel}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* ── Reviews section ── */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t.techPublicProfile.reviewsSection}
            </Text>

            {ratings.length === 0 ? (
              <EmptyState
                icon="star"
                title={t.techPublicProfile.noReviews}
                subtitle={t.techPublicProfile.noReviewsSub}
              />
            ) : (
              ratings.map(r => (
                <View
                  key={r.id}
                  style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.ratingRow}>
                    <View style={{ gap: 2 }}>
                      <Text style={[styles.ratingComment, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
                        {(r as any).customerName ?? t.techPublicProfile.customerFallback}
                      </Text>
                      <StarRating value={r.stars} size={14} />
                    </View>
                    <Text style={[styles.ratingDate, { color: colors.mutedForeground }]}>
                      {fmtDate(r.createdAt, { dateStyle: 'medium' })}
                    </Text>
                  </View>
                  {!!(r as any).review && (
                    <Text style={[styles.ratingComment, { color: colors.foreground }]}>
                      {(r as any).review}
                    </Text>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  heroAccent: { height: 4 },
  heroBody: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 24, paddingBottom: 20, gap: 10 },
  heroAvatar: { width: 90, height: 90, borderRadius: 45 },
  heroAvatarFallback: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 22, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  heroRatingText: { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  heroTotalText: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  statDiv: { width: 1, height: 32 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Cairo_700Bold',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'auto',
  },
  ratingCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingDate: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  ratingComment: { fontSize: 14, fontFamily: 'Cairo_400Regular', textAlign: 'auto', lineHeight: 22 },
});
