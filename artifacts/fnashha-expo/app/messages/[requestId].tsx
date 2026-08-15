import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, apiFetch } from '@/hooks/useApi';
import { fmtTime } from '@/lib/fmt';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MessageTick, type TickState } from '@/components/MessageTick';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { Conversation, Message, ServiceRequest } from '@/types';

export default function ChatScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const authedFetch = useAuthedFetch();
  const qc = useQueryClient();
  const { locale } = useLocale();
  const t = translations[locale];
  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState('');

  const { data: request } = useQuery<ServiceRequest>({
    queryKey: ['request', requestId],
    queryFn: () => authedFetch(`/api/requests/${requestId}`),
    enabled: !!requestId,
  });

  // Mark the conversation read as soon as the chat opens. Update the local
  // conversation cache first so the header/list badge is immediate, then
  // persist delivery + read state without delaying the first render.
  useEffect(() => {
    if (!requestId || !accessToken) return;
    const current = qc.getQueryData<Conversation[]>(['conversations']);
    const openedUnread = current?.find(
      conversation => String(conversation.requestId) === String(requestId),
    )?.unreadCount ?? 0;
    if (openedUnread > 0) {
      qc.setQueryData<number>(['conversations-unread'], total =>
        Math.max(0, (total ?? 0) - openedUnread),
      );
    }
    qc.setQueryData<Conversation[]>(['conversations'], conversations =>
      (conversations ?? []).map(conversation =>
        String(conversation.requestId) === String(requestId)
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );

    // Keep delivery before read so senders see the same state progression.
    const markMessagesSeen = async () => {
      try {
        await apiFetch(`/api/requests/${requestId}/messages/deliver-all`, {
          method: 'PATCH',
          token: accessToken,
        });
      } catch {}
      try {
        await apiFetch(`/api/requests/${requestId}/messages/read-all`, {
          method: 'PATCH',
          token: accessToken,
        });
      } catch {}
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['conversations'] }),
        qc.invalidateQueries({ queryKey: ['conversations-unread'] }),
      ]);
    };
    void markMessagesSeen();
  }, [requestId, accessToken, qc]);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages', requestId],
    queryFn: async () => {
      const msgs = await authedFetch<Message[]>(`/api/requests/${requestId}/messages`);
      return msgs;
    },
    enabled: !!requestId,
    refetchInterval: 10_000, // Poll every 10s for new messages
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const sendMessage = useMutation({
    // ── IMPORTANT: content is passed as a variable, NOT captured via closure.
    // React Query v5 propagates new observer options to a pending mutation on
    // every re-render (MutationObserver.setOptions → currentMutation.setOptions).
    // onMutate calls setText('') which triggers a re-render mid-execution, so a
    // closure-based mutationFn would receive text='' when the retryer actually
    // invokes it — causing a 400 "الرسالة فارغة" error. Passing the content as a
    // variable snapshots it at mutate() call time, before any re-render happens.
    mutationFn: (content: string) =>
      apiFetch<Message>(`/api/requests/${requestId}/messages`, {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ content, type: 'text' }),
      }),
    onMutate: (content: string) => {
      // Optimistic update — _isOptimistic drives the "sending" tick state
      const tempId = Date.now();
      const temp: Message & { _isOptimistic: true } = {
        id: tempId,
        requestId: Number(requestId),
        senderId: user!.id,
        content,
        type: 'text',
        isRead: false,
        isDelivered: false,
        createdAt: new Date().toISOString(),
        _isOptimistic: true,
      };
      qc.setQueryData<Message[]>(['messages', requestId], old => [...(old ?? []), temp as unknown as Message]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return { tempId };
    },
    onSuccess: (newMsg, _content, ctx) => {
      // Replace the optimistic placeholder with the real server message
      qc.setQueryData<Message[]>(['messages', requestId], old =>
        (old ?? []).map(m => (m.id === (ctx as any)?.tempId ? { ...newMsg } : m))
      );
    },
    onError: (err: any, _content, ctx) => {
      // Remove the optimistic placeholder so the chat doesn't show a ghost message
      qc.setQueryData<Message[]>(['messages', requestId], old =>
        (old ?? []).filter(m => m.id !== (ctx as any)?.tempId)
      );
      Alert.alert(t.messages.sendErrorTitle, err?.message || t.messages.sendErrorMessage);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['messages', requestId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMessage.mutate(content);  // content is snapshotted here, before onMutate's setText('') re-renders
  };

  const otherName = (() => {
    if (!request || !user) return t.messages.chatFallback;
    if (user.role === 'customer') return request.selectedTechnician?.fullName ?? t.messages.techFallback;
    return request.customer?.fullName ?? t.messages.customerFallback;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={otherName} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => String(m.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const isMine = item.senderId === user?.id;
              return (
                <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
                  <View style={[
                    styles.bubble,
                    { backgroundColor: isMine ? colors.primary : colors.card, borderColor: colors.border },
                  ]}>
                    <Text style={[styles.bubbleText, { color: isMine ? '#fff' : colors.foreground }]}>
                      {item.content}
                    </Text>
                    <View style={styles.bubbleFooter}>
                      <Text style={[styles.bubbleTime, { color: isMine ? '#ffffff88' : colors.mutedForeground }]}>
                        {fmtTime(item.createdAt, { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {isMine && (
                        <MessageTick
                          state={
                            // 4-state WhatsApp-style tick logic:
                            //  sending   → optimistic placeholder, server hasn't confirmed yet
                            //  sent      → server stored it, recipient hasn't fetched it yet
                            //  delivered → recipient device fetched the message (is_delivered = true)
                            //  read      → recipient opened the chat (is_read = true)
                            (item as any)._isOptimistic
                              ? 'sending'
                              : item.isRead
                              ? 'read'
                              : item.isDelivered
                              ? 'delivered'
                              : 'sent'
                          }
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: TAB_BAR_HEIGHT + (insets.bottom || 12) }]}>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
            onPress={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
          >
            <Feather name="send" size={18} color={text.trim() ? '#fff' : colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
            value={text}
            onChangeText={setText}
            placeholder={t.messages.placeholder}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubbleWrap: { flexDirection: 'row', marginBottom: 4 },
  bubbleWrapMine: { justifyContent: 'flex-end' },
  bubbleWrapOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, borderWidth: 1, gap: 4 },
  bubbleText: { fontSize: 15, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  bubbleTime: { fontSize: 10, fontFamily: 'Cairo_400Regular' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: 'Cairo_400Regular', textAlign: 'auto', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
