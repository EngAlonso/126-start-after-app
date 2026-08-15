import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch } from '@/hooks/useApi';
import { AppHeader } from '@/components/AppHeader';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/EmptyState';
import { RequestCardSkeletonList } from '@/components/SkeletonCard';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { ServiceRequest } from '@/types';

const STATUS_PARAMS: Record<string, string> = {
  pending: 'pending',
  active:  'technician_selected,in_progress,waiting_approval,price_change_requested,offers_received',
  done:    'completed,cancelled_by_customer,cancelled_by_technician,cancelled_by_admin',
};

type RequestEnvelope = { data: ServiceRequest[]; total: number };

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Stable viewability config — must live outside the component (or in a ref)
 * so it never changes identity between renders, which would trigger a
 * "Changing viewabilityConfig on the fly is not supported" warning.
 */
const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 50 };

export default function TechnicianRequestsScreen() {
  const colors      = useColors();
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const authedFetch = useAuthedFetch();
  const { locale }  = useLocale();
  const t           = translations[locale];

  const TABS = [
    { key: 'pending', label: t.techRequests.tabs.pending },
    { key: 'active',  label: t.techRequests.tabs.active },
    { key: 'done',    label: t.techRequests.tabs.done },
  ];

  const { initialTab } = useLocalSearchParams<{ initialTab?: string }>();

  // Parse initial tab once — stable initializer for useState + FlatList's
  // initialScrollIndex so the correct page appears on first render without a flash.
  const initTabIdx = (() => {
    const n = initialTab ? parseInt(initialTab, 10) : 0;
    return Number.isFinite(n) && n >= 0 && n < TABS.length ? n : 0;
  })();

  /** Index of the currently visible page (0 = pending, 1 = active, 2 = done) */
  const [activeTab, setActiveTab] = useState(initTabIdx);

  /**
   * Track the usable height of the pager container so each page's inner
   * FlatList fills the full area. FlatList items in a horizontal list
   * need an explicit height — flex alone is not enough.
   */
  const [pageHeight, setPageHeight] = useState(0);

  const pagerRef = useRef<FlatList>(null);

  // ── Three independent queries — React Query caches each tab separately ─────
  const pendingQuery = useQuery<RequestEnvelope>({
    queryKey: ['requests', 'technician', 'pending'],
    queryFn:  () => authedFetch(`/api/requests?role=technician&status=${STATUS_PARAMS.pending}&limit=50`),
    enabled:  !!user,
  });

  const activeQuery = useQuery<RequestEnvelope>({
    queryKey: ['requests', 'technician', 'active'],
    queryFn:  () => authedFetch(`/api/requests?role=technician&status=${STATUS_PARAMS.active}&limit=50`),
    enabled:  !!user,
  });

  const doneQuery = useQuery<RequestEnvelope>({
    queryKey: ['requests', 'technician', 'done'],
    queryFn:  () => authedFetch(`/api/requests?role=technician&status=${STATUS_PARAMS.done}&limit=50`),
    enabled:  !!user,
  });

  const tabQueries = [pendingQuery, activeQuery, doneQuery];

  useRefetchOnFocus([pendingQuery.refetch, activeQuery.refetch, doneQuery.refetch]);

  // ── Tap a tab: programmatically scroll the pager ──────────────────────────
  const goToTab = useCallback((index: number) => {
    setActiveTab(index);
    pagerRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  /**
   * onViewableItemsChanged fires when a new page becomes the dominant visible
   * item (>50 % of area). It delivers the ITEM INDEX directly — no contentOffset
   * math and no RTL coordinate ambiguity.
   *
   * Must be wrapped in useCallback with an empty dependency array and kept
   * stable, because FlatList does not support changing this handler on the fly.
   */
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveTab(viewableItems[0].index);
      }
    },
    [],
  );

  // ── Render one page of the pager ──────────────────────────────────────────
  const renderPage = useCallback(
    ({ item, index }: { item: typeof TABS[0]; index: number }) => {
      const query    = tabQueries[index];
      const requests = query.data?.data ?? [];

      return (
        <View style={{ width: SCREEN_WIDTH, height: pageHeight }}>
          {query.isLoading ? (
            <View style={{ padding: 16 }}>
              <RequestCardSkeletonList count={4} />
            </View>
          ) : (
            <FlatList
              data={requests}
              keyExtractor={r => String(r.id)}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: TECH_TAB_BAR_HEIGHT + insets.bottom + 24,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={query.isRefetching}
                  onRefresh={query.refetch}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="clipboard"
                  title={item.key === 'pending' ? t.techRequests.emptyPendingTitle : t.techRequests.emptyTitle}
                  subtitle={item.key === 'pending' ? t.techRequests.emptyPendingSubtitle : ''}
                />
              }
              renderItem={({ item: req, index: i }) => (
                <RequestCard request={req} showService accentIndex={i} />
              )}
            />
          )}
        </View>
      );
    },
    // Re-render pages when height is known, queries update, or theme changes
    [pageHeight, pendingQuery, activeQuery, doneQuery, colors, insets, t],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="technician" />

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={styles.tabsRow}>
          {TABS.map((tab, i) => {
            const isActive = activeTab === i;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
                onPress={() => goToTab(i)}
              >
                <Text style={[styles.tabText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Swipeable pager ──────────────────────────────────────────────── */}
      {/*
        onLayout measures the exact usable height so pages can be sized
        explicitly — required for items in a horizontal FlatList.
      */}
      <View
        style={{ flex: 1 }}
        onLayout={e => setPageHeight(e.nativeEvent.layout.height)}
      >
        {/*
          Only mount the pager once we know pageHeight; avoids a zero-height
          flash on the first render and prevents FlatList measuring issues.
        */}
        {pageHeight > 0 && (
          <FlatList
            ref={pagerRef}
            data={TABS}
            keyExtractor={tab => tab.key}
            renderItem={renderPage}
            /*
              Paging behaviour
            */
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            initialScrollIndex={initTabIdx}
            /*
              getItemLayout lets scrollToIndex work instantly without having
              to measure items at scroll time.
            */
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            /*
              Tab sync on swipe — onViewableItemsChanged gives us the visible
              item INDEX directly, with no contentOffset math and no RTL
              coordinate ambiguity (unlike onMomentumScrollEnd).
            */
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
            /*
              directionalLockEnabled: once a gesture is recognised as horizontal
              (pager swipe), iOS won't hand it back to a nested vertical scroller,
              and vice-versa — prevents jittery dual-axis scrolling.
            */
            directionalLockEnabled
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: { flexDirection: 'row' },
  tab:     { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
});
