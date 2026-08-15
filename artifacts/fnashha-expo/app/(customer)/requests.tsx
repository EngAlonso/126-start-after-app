import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { AppHeader } from '@/components/AppHeader';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/EmptyState';
import { RequestCardSkeletonList } from '@/components/SkeletonCard';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { ServiceRequest, RequestStatus } from '@/types';

export default function CustomerRequestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const { locale } = useLocale();
  const t = translations[locale];
  const [activeTab, setActiveTab] = useState<RequestStatus | 'all'>('all');

  const TABS: { key: RequestStatus | 'all'; label: string }[] = [
    { key: 'all',        label: t.customerRequests.tabs.all },
    { key: 'pending',    label: t.customerRequests.tabs.pending },
    { key: 'in_progress',label: t.customerRequests.tabs.inProgress },
    { key: 'completed',  label: t.customerRequests.tabs.completed },
    { key: 'cancelled',  label: t.customerRequests.tabs.cancelled },
  ];

  // API returns { data: [...], total, page, limit } — extract array defensively.
  const { data: rawRequestsResult, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['requests', 'customer'],
    queryFn: () => authedFetch('/api/requests?role=customer&limit=100'),
    enabled: !!user,
  });

  useRefetchOnFocus([refetch]);
  const requests: ServiceRequest[] = Array.isArray(rawRequestsResult)
    ? rawRequestsResult
    : Array.isArray((rawRequestsResult as any)?.data)
      ? (rawRequestsResult as any).data
      : [];

  const filtered = activeTab === 'all'
    ? requests
    : requests.filter(r => {
        if (activeTab === 'in_progress') {
          return ['technician_selected', 'in_progress', 'offers_received', 'waiting_approval'].includes(r.status);
        }
        // The DB stores three distinct cancelled statuses; there is no bare 'cancelled'.
        if (activeTab === 'cancelled') {
          return ['cancelled_by_customer', 'cancelled_by_technician', 'cancelled_by_admin'].includes(r.status);
        }
        return r.status === activeTab;
      });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="customer" />

      {/* Tabs */}
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={tab => tab.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
          renderItem={({ item }) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                style={[styles.tab, { backgroundColor: active ? colors.primary : colors.muted }]}
                onPress={() => setActiveTab(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, { color: active ? '#fff' : colors.mutedForeground }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}>
          <RequestCardSkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="clipboard"
              title={t.customerRequests.emptyTitle}
              subtitle={t.customerRequests.emptySubtitle}
              actionLabel={t.customerRequests.emptyAction}
              onAction={() => router.push('/services')}
            />
          }
          renderItem={({ item, index }) => <RequestCard request={item} accentIndex={index} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  tabText: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
});
