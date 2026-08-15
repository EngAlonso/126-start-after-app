/**
 * SearchableSelect — a scalable modal picker for lists that are too long for chips.
 *
 * - Trigger button shows the current selection or a placeholder.
 * - Pressing opens a full-screen modal with a search field + FlatList.
 * - Works on Expo web and React Native equally (uses core RN primitives only).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/contexts/LocaleContext';

export interface SelectOption {
  value: number | string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: number | string | null;
  onChange: (value: number | string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Label shown above the modal list */
  modalTitle?: string;
  /** When true, draws the trigger border in the destructive/error colour */
  hasError?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'بحث...',
  disabled = false,
  modalTitle,
  hasError = false,
}: Props) {
  const colors = useColors();
  const { direction } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = useCallback(
    (opt: SelectOption) => {
      onChange(opt.value);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  const handleOpen = () => {
    if (!disabled) {
      setQuery('');
      setOpen(true);
    }
  };

  return (
    <>
      {/* ── Trigger ── */}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: colors.card,
            borderColor: hasError ? colors.destructive : colors.border,
          },
          disabled && styles.triggerDisabled,
        ]}
        onPress={handleOpen}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedLabel ? colors.foreground : colors.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <Feather
          name="chevron-down"
          size={16}
          color={disabled ? colors.mutedForeground : colors.foreground}
          style={{ opacity: disabled ? 0.4 : 1 }}
        />
      </TouchableOpacity>

      {/* ── Modal ── */}
      <Modal
        visible={open}
        animationType="slide"
        transparent={Platform.OS !== 'web'}
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <SafeAreaView
            style={[styles.sheet, { backgroundColor: colors.background }]}
          >
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              {modalTitle ? (
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  {modalTitle}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                clearButtonMode="while-editing"
                textAlign={direction === 'rtl' ? 'right' : 'left'}
              />
            </View>

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      { borderBottomColor: colors.border },
                      selected && { backgroundColor: colors.primary + '12' },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: selected ? colors.primary : colors.foreground },
                        selected && { fontFamily: 'Cairo_700Bold' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selected && (
                      <Feather name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    لا توجد نتائج
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Trigger
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
  },
  triggerDisabled: { opacity: 0.45 },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '50%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'auto',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    paddingVertical: 0,
  },

  // Options
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_500Medium',
    textAlign: 'auto',
  },

  // Empty state
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
  },
});
