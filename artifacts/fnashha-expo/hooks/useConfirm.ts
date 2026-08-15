/**
 * useConfirm — cross-platform confirmation dialogs.
 *
 * On Android/iOS: delegates to the native Alert.alert().
 * On Web:         drives the <ConfirmDialog> component via React state.
 *
 * Usage:
 *   const { confirm, showAlert, dialogState } = useConfirm();
 *   // Render <ConfirmDialog state={dialogState} /> once in your screen JSX.
 *
 *   const ok = await confirm({ title, message, confirmText });
 *   if (!ok) return;
 *   // … proceed
 */
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { ConfirmDialogState } from '@/components/ConfirmDialog';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
};

const INITIAL_STATE: ConfirmDialogState = {
  visible: false,
  title: '',
  message: '',
  confirmText: '',
  cancelText: 'Cancel',
  destructive: true,
  onConfirm: () => {},
  onCancel: () => {},
};

export function useConfirm() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(INITIAL_STATE);
  const { locale } = useLocale();
  const t = translations[locale];

  /** Show a two-button confirmation. Returns true if the user confirmed. */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    const {
      title,
      message = '',
      confirmText,
      cancelText = t.common.cancel,
      destructive = true,
    } = options;

    if (Platform.OS !== 'web') {
      // Native — use the system Alert sheet.
      return new Promise((resolve) => {
        Alert.alert(title, message, [
          { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
          {
            text: confirmText,
            style: destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ]);
      });
    }

    // Web — open the React modal.
    return new Promise((resolve) => {
      setDialogState({
        visible: true,
        title,
        message,
        confirmText,
        cancelText,
        destructive,
        onConfirm: () => {
          setDialogState(INITIAL_STATE);
          resolve(true);
        },
        onCancel: () => {
          setDialogState(INITIAL_STATE);
          resolve(false);
        },
      });
    });
  }, []);

  /**
   * Show a simple one-button alert (error / info).
   * On native: Alert.alert.  On web: window.alert (synchronous).
   */
  const showAlert = useCallback((title: string, message?: string) => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message);
    } else {
      // eslint-disable-next-line no-alert
      window.alert(message ? `${title}\n\n${message}` : title);
    }
  }, []);

  return { confirm, showAlert, dialogState };
}
