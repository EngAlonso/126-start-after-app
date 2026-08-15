import React from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { StarRating } from '@/components/StarRating';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, resolveMediaUrl } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import type { Rating } from '@/types';
import { fmtDate } from '@/lib/fmt';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

interface RatingsResponse {
  ratings: Rating[];
  averageRating: number | string;
  reviewCount: number | string;
}

function RatingCard({ rating }: { rating: Rating }) {
  const { locale, isRTL } = useLocale();
  const t = translations[locale];
  const colors = useColors();
  const customerName = rating.customer?.fullName || t.techRatings.customerFallback;
  const serviceName = rating.service?.nameAr || rating.service?.name || t.techRatings.serviceFallback;
  const review = rating.review?.trim();

  return (
    <View style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border, direction: isRTL ? 'rtl' : 'ltr' }]}>
      <View style={styles.ratingTopRow}>
        {/* Rating score — leading (RIGHT) in RTL */}
        <View style={styles.ratingScore}>
          <Text style={styles.ratingNumber}>{Number(rating.stars).toFixed(1)}</Text>
          <Feather name="star" size={14} color="#D97706" />
        </View>

        {/* Customer info — center */}
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: colors.foreground }]} numberOfLines={1}>
            {customerName}
          </Text>
          <View style={styles.serviceRow}>
            <Feather name="briefcase" size={12} color={colors.mutedForeground} />
            <Text style={[styles.serviceName, { color: colors.mutedForeground }]} numberOfLines={1}>
              {serviceName}
            </Text>
          </View>
        </View>

        {/* Avatar — trailing (LEFT) in RTL */}
        {resolveMediaUrl(rating.customer?.profileImage) ? (
          <Image source={{ uri: resolveMediaUrl(rating.customer?.profileImage)! }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: '#E9B73A1C' }]}>
            <Feather name="user" size={19} color="#C89820" />
          </View>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.ratingMetaRow}>
        {/* Stars lead in RTL (RIGHT) and trail in LTR (LEFT). */}
        <StarRating value={rating.stars} size={15} gap={2} />
        {/* Date trails in RTL (LEFT) and leads in LTR (RIGHT). */}
        <View style={styles.dateRow}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {fmtDate(rating.createdAt, { dateStyle: 'medium' })}
          </Text>
        </View>
      </View>

      {review ? (
        <Text style={[styles.reviewText, { color: colors.foreground }]}>
          {review}
        </Text>
      ) : null}
    </View>
  );
}

export default function TechRatingsScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<RatingsResponse>({
    queryKey: ['tech-ratings', user?.id],
    queryFn: () => authedFetch(`/api/ratings/technician/${user!.id}`),
    enabled: !!user?.id,
  });

  useRefetchOnFocus([refetch]);

  const ratings = data?.ratings ?? [];
  const averageRating = Number(data?.averageRating ?? 0);
  const totalRatings = Number(data?.reviewCount ?? ratings.length);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t.techRatings.screenTitle} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TECH_TAB_BAR_HEIGHT + insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Outer View carries elevation + backgroundColor to prevent Android white rectangle.
            The inner LinearGradient uses overflow:'hidden' to clip decorative circles. */}
        <View style={styles.summaryCardOuter}>
          <LinearGradient
            colors={['#FFFBEB', '#FEF3C7', '#FDE68A33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={[styles.summaryDecor, { backgroundColor: '#FDE68A66', bottom: -32, left: -24 }]} />
            <View style={[styles.summaryDecorSmall, { backgroundColor: '#FDE68A55', top: -12, right: 34 }]} />
            <View style={styles.summaryIcon}>
              <Feather name="star" size={21} color="#D97706" />
            </View>
            <Text style={styles.summaryEyebrow}>{t.techRatings.eyebrow}</Text>
            <Text style={styles.averageValue}>
              {averageRating.toFixed(1)}
            </Text>
            <StarRating value={averageRating} size={20} gap={4} />
            <View style={styles.totalPill}>
              <Text style={styles.totalText}>{t.techRatings.ratingCount(totalRatings)}</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.techRatings.sectionTitle}</Text>
          {totalRatings > 0 && (
            <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
              {t.techRatings.ratingCount(totalRatings)}
            </Text>
          )}
        </View>

        {isLoading ? (
          <View style={styles.list}>
            <SkeletonList count={3} height={148} gap={12} />
          </View>
        ) : isError ? (
          <EmptyState
            icon="wifi-off"
            title={t.techRatings.loadErrorTitle}
            subtitle={t.techRatings.loadErrorSubtitle}
          />
        ) : ratings.length === 0 ? (
          <EmptyState
            icon="star"
            title={t.techRatings.emptyTitle}
            subtitle={t.techRatings.emptySubtitle}
          />
        ) : (
          <View style={styles.list}>
            {ratings.map((rating) => (
              <RatingCard key={rating.id} rating={rating} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 16 },
  // Outer wrapper: carries elevation + backgroundColor to prevent Android white rectangle
  summaryCardOuter: {
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB', // matches gradient start
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  // Inner gradient: clips decorative circles, no elevation
  summaryCard: {
    minHeight: 214,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  summaryDecor: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  summaryDecorSmall: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  summaryEyebrow: {
    color: '#B45309',
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  averageValue: {
    color: '#78350F',
    fontSize: 42,
    lineHeight: 50,
    fontFamily: 'Cairo_700Bold',
  },
  totalPill: {
    backgroundColor: '#FFFFFF99',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginTop: 8,
  },
  totalText: {
    color: '#92400E',
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  sectionCount: { fontSize: 12, fontFamily: 'Cairo_500Medium' },
  list: { paddingHorizontal: 16 },
  ratingCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  ratingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInfo: { flex: 1, alignItems: 'flex-start', gap: 3 },
  customerName: {
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'auto',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  serviceName: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },
  ratingScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ratingNumber: {
    color: '#92400E',
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
  },
  divider: { height: 1, opacity: 0.8, marginVertical: 12 },
  ratingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  reviewText: {
    fontSize: 13,
    lineHeight: 22,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    marginTop: 11,
  },
});