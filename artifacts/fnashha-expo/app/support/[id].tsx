import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, apiFetch } from '@/hooks/useApi';
import { fmtDate, fmtTime } from '@/lib/fmt';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonList } from '@/components/SkeletonCard';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { SupportTicket, TicketReply } from '@/types';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const authedFetch = useAuthedFetch();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  const STATUS: Record<string, { label: string; color: string }> = {
    open:        { label: t.support.statusOpen,       color: '#3B82F6' },
    in_progress: { label: t.support.statusInProgress, color: '#F59E0B' },
    resolved:    { label: t.support.statusResolved,   color: '#10B981' },
    closed:      { label: t.support.statusClosed,     color: '#6B7280' },
  };

  const { data: ticket, isLoading } = useQuery<SupportTicket>({
    queryKey: ['support-ticket', id],
    queryFn: () => authedFetch(`/api/support/tickets/${id}`),
    enabled: !!id,
  });

  // Mark related support_reply notifications as read when the ticket is opened.
  // Mirrors the web app's useEffect in customer/support.tsx.
  useEffect(() => {
    if (!id || !accessToken) return;
    apiFetch('/api/notifications/read-related', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify({ relatedId: Number(id), types: ['support_reply'] }),
    })
      .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sendReply = useMutation({
    mutationFn: () =>
      apiFetch(`/api/support/tickets/${id}/reply`, {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ message: reply }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', id] });
      setReply('');
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message),
  });

  const status = ticket ? (STATUS[ticket.status] ?? { label: ticket.status, color: colors.mutedForeground }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.support.ticketTitle(id ?? '')} />
      {isLoading ? (
        <View style={{ padding: 16 }}><SkeletonList count={4} /></View>
      ) : !ticket ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.mutedForeground }}>{t.support.notFound}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Status + subject */}
            <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.headerRow}>
                {status && (
                  <View style={[styles.badge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                )}
                <Text style={[styles.ticketId, { color: colors.mutedForeground }]}>#{ticket.id}</Text>
              </View>
              <Text style={[styles.subject, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{ticket.subject}</Text>
              <Text style={[styles.date, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                {fmtDate(ticket.createdAt, { dateStyle: 'long' })}
              </Text>
            </View>

            {/* Original message */}
            <View style={[styles.messageCard, { backgroundColor: colors.muted }]}>
              <Text style={[styles.msgLabel, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{t.support.originalMessage}</Text>
              <Text style={[styles.msgText, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{ticket.message}</Text>
            </View>

            {/* Replies */}
            {(ticket.replies ?? []).map(r => (
              <View
                key={r.id}
                style={[
                  styles.replyCard,
                  r.isAdmin
                    ? { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.replySender, { color: r.isAdmin ? colors.primary : colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {r.isAdmin ? t.support.supportTeam : t.support.youLabel}
                </Text>
                <Text style={[styles.replyText, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{r.message}</Text>
                <Text style={[styles.replyDate, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {fmtTime(r.createdAt, { dateStyle: 'short', timeStyle: 'short' } as any)}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Reply input — matches web: allowed for any status except 'closed' */}
          {ticket.status !== 'closed' && (
            <View style={[styles.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: TAB_BAR_HEIGHT + (insets.bottom || 12) }]}>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: reply.trim() ? colors.primary : colors.muted }]}
                onPress={() => reply.trim() && sendReply.mutate()}
                disabled={!reply.trim() || sendReply.isPending}
              >
                {sendReply.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Feather name="send" size={18} color={reply.trim() ? '#fff' : colors.mutedForeground} />}
              </TouchableOpacity>
              <TextInput
                style={[styles.replyInput, { color: colors.foreground, backgroundColor: colors.muted, textAlign: isRTL ? 'right' : 'left' }]}
                value={reply}
                onChangeText={setReply}
                placeholder={t.support.replyPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={2000}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  ticketId: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  subject: { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  date: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  messageCard: { borderRadius: 14, padding: 14, gap: 6 },
  msgLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  msgText: { fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  replyCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  replySender: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  replyText: { fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  replyDate: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  replyBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  replyInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: 'Cairo_400Regular', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
