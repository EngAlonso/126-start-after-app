/**
 * Shared top header for main tab screens.
 *
 * Customer layout (locale-aware visual order):
 *   [Logo]  [Coins balance]  [Messages] [Notifications]
 *
 * Technician layout (locale-aware visual order):
 *   [Logo]  [Points balance]  [Messages] [Notifications]
 *
 * The selected app locale controls direction; device language is ignored.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import { useAuthedFetch } from '@/hooks/useApi';
import { AppLogo } from './AppLogo';
import type { LoyaltyWallet, PointsBalance, Notification } from '@/types';
import { fmtNumber } from '@/lib/fmt';

interface AppHeaderProps {
  role: 'customer' | 'technician';
}

export function AppHeader({ role }: AppHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { locale, direction } = useLocale();
  const t = translations[locale];
  const authedFetch = useAuthedFetch();
  const topPad = Platform.OS === 'web' ? 12 : insets.top;

  // Customer: load coins balance
  const { data: wallet } = useQuery<LoyaltyWallet>({
    queryKey: ['wallet'],
    queryFn: () => authedFetch('/api/loyalty/wallet'),
    enabled: role === 'customer' && !!user,
    staleTime: 60_000,
  });

  // Technician: load points balance
  const { data: points } = useQuery<PointsBalance>({
    queryKey: ['points-balance'],
    queryFn: () => authedFetch('/api/points/balance'),
    enabled: role === 'technician' && !!user,
    staleTime: 60_000,
  });

  // Unread notification count — keep limit in key so it doesn't collide
  // with the notifications screen which fetches limit=100.
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', 50],
    queryFn: () => authedFetch('/api/notifications?limit=50'),
    enabled: !!user,
    staleTime: 30_000,
  });
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Conversation rows already expose the server-authoritative unread count.
  // Keep this query separate from the screen list so the header can show the
  // total on every authenticated screen.
  const { data: unreadMessages = 0 } = useQuery<number>({
    queryKey: ['conversations-unread'],
    queryFn: async () => {
      const conversations = await authedFetch<Array<{ unread_count?: number }>>('/api/conversations');
      return conversations.reduce(
        (total, conversation) => total + (Number(conversation.unread_count) || 0),
        0,
      );
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPad + 8,
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          direction,
          flexDirection: 'row',
        },
      ]}
    >
      {/* Slot 1 (visual RIGHT in RTL): Logo — taps to go home */}
      <TouchableOpacity
        onPress={() =>
          router.push(role === 'customer' ? '/(customer)' : '/(technician)')
        }
        activeOpacity={0.8}
      >
        <AppLogo size={40} />
      </TouchableOpacity>

      {/* Slot 2 (CENTER): Balance badge */}
      {role === 'customer' ? (
        <TouchableOpacity
          style={[styles.balanceBadge, { backgroundColor: colors.primary + '18' }]}
          onPress={() => router.push('/customer-wallet')}
          activeOpacity={0.8}
        >
          <Feather name="star" size={14} color={colors.primary} />
          <Text style={[styles.balanceText, { color: colors.primary }]}>
            {fmtNumber(wallet?.availableCoins ?? 0)} {t.customerWallet.coinUnit}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.balanceBadge, { backgroundColor: colors.primary + '18' }]}
          onPress={() => router.push('/(technician)/wallet')}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={14} color={colors.primary} />
          <Text style={[styles.balanceText, { color: colors.primary }]}>
            {points ? fmtNumber(points.available) : '—'}
          </Text>
          <Text style={[styles.balanceLabel, { color: colors.primary }]}>{t.techAccount.pointsUnit}</Text>
        </TouchableOpacity>
      )}

      {/* Slot 3 (visual LEFT in RTL): Action icons */}
      <View style={styles.actions}>
        {/* Messages */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push('/messages')}
          activeOpacity={0.8}
        >
          <Feather name="message-circle" size={20} color={colors.foreground} />
          {unreadMessages > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary, [direction === 'rtl' ? 'right' : 'left']: 0 }]}>
              <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Notifications */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
          {unreadCount > 0 && (
           <View style={[styles.badge, { backgroundColor: colors.destructive, [direction === 'rtl' ? 'right' : 'left']: 0 }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  balanceBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  balanceText: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Cairo_700Bold',
  },
});
