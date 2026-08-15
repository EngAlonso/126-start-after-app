import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fmtDate } from '@/lib/fmt';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { SupportTicket } from '@/types';

export default function SupportTicketsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  const STATUS: Record<string, { label: string; color: string }> = {
    open:        { label: t.support.statusOpen,       color: '#3B82F6' },
    in_progress: { label: t.support.statusInProgress, color: '#F59E0B' },
    resolved:    { label: t.support.statusResolved,   color: '#10B981' },
    closed:      { label: t.support.statusClosed,     color: '#6B7280' },
  };

  const { data: tickets = [], isLoading, refetch, isRefetching } = useQuery<SupportTicket[]>({
    queryKey: ['support-tickets'],
    queryFn: () => authedFetch('/api/support/tickets'),
    enabled: !!user,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t.support.listTitle}
        rightElement={
          <TouchableOpacity onPress={() => router.push('/support/new')}>
            <Feather name="plus" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      {isLoading ? (
        <View style={{ padding: 16 }}><SkeletonList count={4} height={90} /></View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="help-circle"
              title={t.support.noTickets}
              subtitle={t.support.helpQ}
              actionLabel={t.support.openTicketBtn}
              onAction={() => router.push('/support/new')}
            />
          }
          renderItem={({ item }) => {
            const status = STATUS[item.status] ?? { label: item.status, color: colors.mutedForeground };
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/support/${item.id}` as any)}
                activeOpacity={0.8}
              >
                <View style={styles.header}>
                  <View style={[styles.badge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={[styles.ticketId, { color: colors.mutedForeground }]}>#{item.id}</Text>
                </View>
                <Text style={[styles.subject, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{item.subject}</Text>
                <Text style={[styles.preview, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>{item.message}</Text>
                <Text style={[styles.date, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {fmtDate(item.createdAt, { dateStyle: 'medium' })}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  ticketId: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  subject: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  preview: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  date: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
