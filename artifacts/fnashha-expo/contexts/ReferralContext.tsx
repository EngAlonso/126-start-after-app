import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const REFERRAL_CODE_STORAGE_KEY = 'pendingReferralCode';

interface ReferralContextValue {
  referralCode: string | null;
  isReady: boolean;
  setReferralCode: (code: string | null) => void;
  captureReferralUrl: (url: string | null | undefined) => string | null;
  clearReferralCode: () => Promise<void>;
}

const ReferralContext = createContext<ReferralContextValue | null>(null);

function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() ?? '';
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

export function referralCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path?.replace(/^\/+|\/+$/g, '') ?? '';
    const pathParts = path ? path.split('/') : [];

    // HTTPS Universal/App Links parse as fnashha.com/r/CODE. A custom
    // fnashha-expo://r/CODE link parses with "r" as the hostname and CODE
    // as the path, so support both shapes without changing the production
    // HTTPS link format.
    const segment = parsed.hostname?.toLowerCase() === 'r'
      ? 'r'
      : pathParts[0]?.toLowerCase();
    const code = parsed.hostname?.toLowerCase() === 'r'
      ? pathParts[0]
      : pathParts[1];

    if (segment !== 'r') return null;
    return normalizeReferralCode(code);
  } catch {
    return null;
  }
}

export function ReferralProvider({ children }: { children: ReactNode }) {
  const [referralCode, setReferralCodeState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const latestIncomingCodeRef = useRef<string | null>(null);

  const setReferralCode = useCallback((code: string | null) => {
    const normalized = normalizeReferralCode(code);
    latestIncomingCodeRef.current = normalized;
    setReferralCodeState(normalized);

    if (normalized) {
      AsyncStorage.setItem(REFERRAL_CODE_STORAGE_KEY, normalized).catch(() => null);
    }
  }, []);

  const captureReferralUrl = useCallback((url: string | null | undefined) => {
    const code = referralCodeFromUrl(url);
    if (code) setReferralCode(code);
    return code;
  }, [setReferralCode]);

  const clearReferralCode = useCallback(async () => {
    latestIncomingCodeRef.current = null;
    setReferralCodeState(null);
    await AsyncStorage.removeItem(REFERRAL_CODE_STORAGE_KEY).catch(() => null);
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      captureReferralUrl(url);
    });

    (async () => {
      const [storedCode, initialUrl] = await Promise.all([
        AsyncStorage.getItem(REFERRAL_CODE_STORAGE_KEY).catch(() => null),
        Linking.getInitialURL().catch(() => null),
      ]);

      const initialCode = referralCodeFromUrl(initialUrl);
      const code = latestIncomingCodeRef.current
        ?? initialCode
        ?? normalizeReferralCode(storedCode);

      if (code) {
        latestIncomingCodeRef.current = code;
        setReferralCodeState(code);
        await AsyncStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code).catch(() => null);
      } else {
        setReferralCodeState(null);
      }

      setIsReady(true);
    })().catch(() => {
      setIsReady(true);
    });

    return () => subscription.remove();
  }, [captureReferralUrl]);

  const value = useMemo<ReferralContextValue>(() => ({
    referralCode,
    isReady,
    setReferralCode,
    captureReferralUrl,
    clearReferralCode,
  }), [referralCode, isReady, setReferralCode, captureReferralUrl, clearReferralCode]);

  return (
    <ReferralContext.Provider value={value}>
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferral() {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error('useReferral must be used within ReferralProvider');
  }
  return context;
}