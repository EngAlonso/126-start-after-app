import React, { useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Image,
  RefreshControl, Platform, Animated,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, resolveMediaUrl } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { Conversation } from '@/types';

const GOLD = '#E9B73A';

// ─── Raw shape returned by the backend SQL query ─────────────────────────────
interface RawConversation {
  request_id: number;
  status: string;
  service_name: string;
  customer_id: number;
  customer_name: string;
  technician_id: number | null;
  technician_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_type: string | null;
  message_count: number;
  unread_count: number;
}

/** Map the raw SQL row into the Conversation shape the UI expects. */
function toConversation(raw: RawConversation, myId: number): Conversation {
  const isCustomer = raw.customer_id === myId;
  const otherName = isCustomer ? raw.technician_name : raw.customer_name;
  return {
    requestId: raw.request_id,
    unreadCount: Number(raw.unread_count) || 0,
    lastMessage: raw.last_message_at
      ? {
          id: 0,
          requestId: raw.request_id,
          senderId: 0,
          content: raw.last_message ?? undefined,
          type: (raw.last_message_type as 'text' | 'image') ?? 'text',
          isRead: false,
          isDelivered: false,
          createdAt: raw.last_message_at,
        }
      : null,
    otherUser: otherName ? { fullName: otherName } : undefined,
  };
}

// ─── Conversation Card ────────────────────────────────────────────────────────

interface CardProps {
  item: Conversation;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: (typeof translations)[keyof typeof translations];
  timeAgo: (d: string) => string;
  onOpen: (requestId: number) => void;
}

function ConversationCard({ item, colors, isRTL, t, timeAgo, onOpen }: CardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 2,
    }).start();
  }, [scale]);

  const otherUser = item.otherUser;
  const name = otherUser?.fullName ?? t.conversationsList.requestFallback(item.requestId);
  const lastMsg = item.lastMessage;
  const hasUnread = item.unreadCount > 0;

  const borderColor = hasUnread ? GOLD : GOLD + '66';          // full vs 40% opacity
  const borderWidth = hasUnread ? 1.5 : 1;
  const cardBg = hasUnread ? colors.primary + '08' : colors.card;

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPress={() => onOpen(item.requestId)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: GOLD + '22', borderless: false }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor,
            borderWidth,
            // iOS subtle opacity feedback
            opacity: Platform.OS === 'ios' && pressed ? 0.85 : 1,
          },
        ]}
      >
        {/* Gold accent line — right edge in RTL, left edge in LTR */}
        <View
          style={[
            styles.accentLine,
            {
              backgroundColor: hasUnread ? GOLD : GOLD + 'AA',
              [isRTL ? 'right' : 'left']: 0,
            },
          ]}
        />

        {/* Avatar */}
        {resolveMediaUrl(otherUser?.profileImage) ? (
          <Image source={{ uri: resolveMediaUrl(otherUser?.profileImage)! }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{name[0] ?? '؟'}</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {lastMsg ? timeAgo(lastMsg.createdAt) : ''}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.preview,
                {
                  color: hasUnread ? colors.foreground : colors.mutedForeground,
                  fontFamily: hasUnread ? 'Cairo_600SemiBold' : 'Cairo_400Regular',
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              numberOfLines={1}
            >
              {lastMsg?.content ||
                (lastMsg?.type === 'image'
                  ? t.conversationsList.imageMessage
                  : t.conversationsList.startChat)}
            </Text>
            {hasUnread && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// memoize to avoid re-renders when the list scrolls
const MemoCard = React.memo(ConversationCard);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConversationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const authedFetch = useAuthedFetch();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  const timeAgo = useCallback(
    (date: string) => {
      const diff = Date.now() - new Date(date).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return t.conversationsList.timeNow;
      if (mins < 60) return t.conversationsList.minAbbr(mins);
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return t.conversationsList.hrAbbr(hrs);
      return t.conversationsList.dayAbbr(Math.floor(hrs / 24));
    },
    [t, locale],
  );

  const { data: conversations = [], isLoading, refetch, isRefetching } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const rows = await authedFetch<RawConversation[]>('/api/conversations');
      return rows.map(row => toConversation(row, user!.id));
    },
    enabled: !!user,
  });

  useRefetchOnFocus([refetch]);

  const openConversation = useCallback((requestId: number) => {
    // Make the badge disappear before the chat request completes. The chat
    // screen also confirms the read on the server when it mounts.
    const current = qc.getQueryData<Conversation[]>(['conversations']);
    const openedUnread = current?.find(conversation => conversation.requestId === requestId)?.unreadCount ?? 0;
    if (openedUnread > 0) {
      qc.setQueryData<number>(['conversations-unread'], total =>
        Math.max(0, (total ?? 0) - openedUnread),
      );
    }
    qc.setQueryData<Conversation[]>(['conversations'], conversations =>
      (conversations ?? []).map(conversation =>
        conversation.requestId === requestId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
    router.push(`/messages/${requestId}` as any);
  }, [qc]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <MemoCard
        item={item}
        colors={colors}
        isRTL={isRTL}
        t={t}
        timeAgo={timeAgo}
        onOpen={openConversation}
      />
    ),
    [colors, isRTL, t, timeAgo, openConversation],
  );

  const keyExtractor = useCallback((c: Conversation) => String(c.requestId), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' } as any}>
      <ScreenHeader title={t.conversationsList.title} />
      {isLoading ? (
        <View style={{ padding: 16 }}>
          <SkeletonList count={5} height={80} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="message-circle"
              title={t.conversationsList.noConversations}
              subtitle={t.conversationsList.noConversationsSub}
            />
          }
          removeClippedSubviews
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    borderRadius: 18,
    overflow: 'hidden',
    // subtle elevation
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      },
    }),
  },
  accentLine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    width: 3.5,
    borderRadius: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontFamily: 'Cairo_700Bold' },
  content: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: { fontSize: 15, fontFamily: 'Cairo_700Bold', flex: 1, marginEnd: 8 },
  time: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: { flex: 1, fontSize: 13, marginEnd: 6 },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Cairo_700Bold' },
});
