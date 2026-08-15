import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { SupportTicket } from '@/types';

export default function NewTicketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const createTicket = useMutation({
    mutationFn: () =>
      apiFetch<SupportTicket>('/api/support/tickets', {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ subject, message }),
      }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      Alert.alert(t.support.sentTitle, t.support.sentMsg, [
        { text: t.support.ok, onPress: () => router.replace(`/support/${ticket.id}` as any) },
      ]);
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message),
  });

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert(t.support.warningTitle, t.support.fillAllFields);
      return;
    }
    createTicket.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.support.openTicketBtn} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{t.support.subjectLabel}</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}
              value={subject}
              onChangeText={setSubject}
              placeholder={t.support.subjectPlaceholder}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{t.support.detailsLabel}</Text>
          <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}
              value={message}
              onChangeText={setMessage}
              placeholder={t.support.detailsPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }, createTicket.isPending && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={createTicket.isPending}
          activeOpacity={0.85}
        >
          {createTicket.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.support.submitBtn}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  inputWrap: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  input: { fontSize: 15, fontFamily: 'Cairo_400Regular' },
  textAreaWrap: { borderWidth: 1, borderRadius: 12, padding: 12 },
  textArea: { fontSize: 14, fontFamily: 'Cairo_400Regular', minHeight: 140 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 17, fontFamily: 'Cairo_700Bold' },
});
