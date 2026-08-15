/**
 * ThemeContext — user-controlled dark/light mode preference.
 *
 * Persists to AsyncStorage (key: fnashha_theme_mode).
 * Starts as light and applies the saved preference after the first render
 * (avoids a blocking async read before the app can paint).
 *
 * All components that call useColors() automatically inherit the selected
 * palette because useColors() reads from this context instead of the OS
 * colorScheme.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND } from '@/constants/brand';

const STORAGE_KEY = BRAND.STORAGE_KEYS.THEME;

type ThemeContextValue = {
  isDark: boolean;
  setDark: (dark: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  setDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState] = useState(false);

  // Load saved preference on first mount — non-blocking
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val === 'dark') setIsDarkState(true); })
      .catch(() => {});
  }, []);

  const setDark = (dark: boolean) => {
    // Update state immediately (instant UI update)
    setIsDarkState(dark);
    // Persist in background (fire-and-forget)
    AsyncStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light').catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ isDark, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
