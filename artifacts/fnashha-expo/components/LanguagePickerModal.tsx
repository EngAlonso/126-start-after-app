/**
 * LanguagePickerModal — cross-platform language selector.
 *
 * Uses React Native Modal instead of Alert.alert so it works on both
 * native AND Expo Web (where window.alert/confirm are blocked inside iframes).
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePickerModal({ visible, onClose }: Props) {
  const colors = useColors();
  const { locale, setLocale, direction } = useLocale();
  const t = translations[locale];

  const handleSelect = async (next: Locale) => {
    onClose();
    await setLocale(next);
  };

  const options: { locale: Locale; label: string }[] = [
    { locale: 'ar', label: t.common.languageArabic },
    { locale: 'en', label: t.common.languageEnglish },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Stop propagation so tapping the sheet itself doesn't close */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { /* noop — prevents backdrop close */ }}
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, direction } as any]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border, direction } as any]}>
            <Feather name="globe" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t.common.language}
            </Text>
          </View>

          {/* Language options */}
          {options.map(({ locale: optLocale, label }) => {
            const isActive = locale === optLocale;
            return (
              <TouchableOpacity
                key={optLocale}
                style={[
                  styles.option,
                  { borderBottomColor: colors.border + '60', direction } as any,
                  isActive && { backgroundColor: colors.primary + '0F' },
                ]}
                onPress={() => handleSelect(optLocale)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  { color: isActive ? colors.primary : colors.foreground },
                ]}>
                  {label}
                </Text>
                {isActive && (
                  <Feather name="check" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelBtn, { borderTopColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              {t.common.cancel}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
    flex: 1,
    textAlign: 'auto',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'Cairo_500Medium',
  },
});
