/**
 * ConfirmDialog — web-only modal confirmation.
 * On native, Alert.alert() is used directly inside useConfirm (never mounted).
 * This component is only rendered on web.
 */
import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

export type ConfirmDialogState = {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

type Props = { state: ConfirmDialogState };

/** Render this once per screen that uses useConfirm(). */
export function ConfirmDialog({ state }: Props) {
  const colors = useColors();

  // On native the hook never sets visible=true, but guard anyway.
  if (Platform.OS !== 'web') return null;

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      onRequestClose={state.onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{state.title}</Text>
          {!!state.message && (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>{state.message}</Text>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
              onPress={state.onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>{state.cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.confirmBtn,
                { backgroundColor: state.destructive ? colors.destructive : colors.primary },
              ]}
              onPress={state.onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>{state.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 24,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginTop: 20,
  },
  buttons: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  confirmBtn: {},
  btnText: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
  },
});
