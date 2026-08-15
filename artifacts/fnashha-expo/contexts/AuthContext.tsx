import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppUser } from '@/types';
import { apiUrl, setRefreshHandler } from '@/hooks/api-base';
import { queryClient } from '@/lib/queryClient';

interface AuthState {
  user: AppUser | null;
  accessToken: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (user: AppUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── JWT helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the JWT is expired (or malformed).
 * Adds a 30-second clock-skew buffer so we refresh slightly early.
 */
function isJwtExpired(token: string): boolean {
  try {
    const seg = token.split('.')[1];
    if (!seg) return true;
    // Handle URL-safe base64 (no padding required for JSON.parse)
    const payload = JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true; // treat malformed token as expired
  }
}

/**
 * Calls POST /api/auth/refresh and returns the new token pair on success,
 * or null if the refresh token is expired / revoked.
 */
async function doRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const at: string | undefined = data.accessToken ?? data.token;
    const rt: string | undefined = data.refreshToken;
    if (!at || !rt) return null;
    return { accessToken: at, refreshToken: rt };
  } catch {
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  // Keep a ref to current state so we can read it synchronously inside callbacks
  // without stale-closure problems.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Deduplicates concurrent 401-triggered refreshes so only one HTTP call
  // is made even if multiple in-flight requests fail at the same time.
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  // ── Rehydrate from storage on mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet(['accessToken', 'refreshToken', 'user']);
        const tokenVal        = pairs[0][1];
        const refreshTokenVal = pairs[1][1];
        const userVal         = pairs[2][1];

        if (tokenVal && userVal) {
          if (isJwtExpired(tokenVal) && refreshTokenVal) {
            // Access token is expired — try a silent refresh before deciding
            // whether to restore the session or force the user to log in again.
            const refreshed = await doRefresh(refreshTokenVal);
            if (refreshed) {
              await AsyncStorage.multiSet([
                ['accessToken', refreshed.accessToken],
                ['refreshToken', refreshed.refreshToken],
              ]);
              const restoredUser = JSON.parse(userVal) as AppUser;
              setState({
                user: restoredUser,
                accessToken: refreshed.accessToken,
                isLoading: false,
              });
            } else {
              // Both tokens expired / revoked — clear session, show login screen.
              await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
              setState({ user: null, accessToken: null, isLoading: false });
            }
          } else {
            // Token is still valid (or near-valid) — restore session as-is.
            const restoredUser = JSON.parse(userVal) as AppUser;
            setState({
              user: restoredUser,
              accessToken: tokenVal,
              isLoading: false,
            });
          }
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  // ── Register the global refresh handler used by apiFetch ─────────────────
  // When any authenticated request returns 401 mid-session, apiFetch calls
  // this handler to get a fresh token and retry — mirroring the web app's
  // setUnauthorizedHandler / customFetch pattern.
  useEffect(() => {
    setRefreshHandler(async () => {
      // Dedup: if a refresh is already in progress, await the same promise.
      if (refreshInFlightRef.current) return refreshInFlightRef.current;

      refreshInFlightRef.current = (async (): Promise<string | null> => {
        const stored = await AsyncStorage.getItem('refreshToken').catch(() => null);
        if (!stored) return null;

        const refreshed = await doRefresh(stored);
        if (!refreshed) {
          // Refresh token also invalid — force logout so the user sees the login screen.
          queryClient.clear();
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']).catch(() => null);
          setState({ user: null, accessToken: null, isLoading: false });
          return null;
        }

        // Persist new tokens and update state.
        await AsyncStorage.multiSet([
          ['accessToken', refreshed.accessToken],
          ['refreshToken', refreshed.refreshToken],
        ]).catch(() => null);
        setState(prev => ({ ...prev, accessToken: refreshed.accessToken }));
        return refreshed.accessToken;
      })().finally(() => {
        refreshInFlightRef.current = null;
      });

      return refreshInFlightRef.current;
    });

    return () => setRefreshHandler(null);
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(async (user: AppUser, accessToken: string, refreshToken: string) => {
    // Strip heavy fields before persisting (quota safety)
    const safeUser: AppUser = {
      ...user,
      technicianProfile: user.technicianProfile
        ? { ...user.technicianProfile }
        : null,
    };
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(safeUser)],
    ]);

    setState({ user: safeUser, accessToken, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    // Clear all cached queries first so no screen ever renders stale user data
    // after navigation. This must happen before setState so that query observers
    // that re-render on state change already see an empty cache.
    queryClient.clear();

    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    setState({ user: null, accessToken: null, isLoading: false });
  }, []);

  const updateUser = useCallback(async (patch: Partial<AppUser>) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...patch };
      // Persist in background
      AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => null);
      return { ...prev, user: updated };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
