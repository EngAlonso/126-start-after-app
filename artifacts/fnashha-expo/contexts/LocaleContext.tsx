import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCALE, getDirection, isRTLLocale } from '@/lib/i18n';
import type { Direction, Locale } from '@/lib/i18n';

const LOCALE_STORAGE_KEY = '@fnashha/locale';

// ── Context shape ─────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  direction: Direction;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

// ── Hook: useLocale ───────────────────────────────────────────────────────────

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>');
  }
  return ctx;
}

// ── Hook: useDirection ────────────────────────────────────────────────────────

export function useDirection(): { direction: Direction; isRTL: boolean } {
  const { direction, isRTL } = useLocale();
  return { direction, isRTL };
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore persisted locale on mount
  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'ar' || stored === 'en') {
          setLocaleState(stored);
        }
      })
      .catch(() => {
        // Ignore storage errors — fall back to default
      })
      .finally(() => setIsHydrated(true));
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const direction = getDirection(locale);
  const isRTL = isRTLLocale(locale);

  if (!isHydrated) return null;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, direction, isRTL }}>
      {children}
    </LocaleContext.Provider>
  );
}
