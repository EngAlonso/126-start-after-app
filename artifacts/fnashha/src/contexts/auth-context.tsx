import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { User, setUnauthorizedHandler } from "@workspace/api-client-react";
import { unregisterPushToken } from "@/lib/push-notifications";
import { unregisterWebPushToken } from "@/lib/web-push";
import { API_BASE } from "@/lib/api-config";

// Persists across the tab's lifetime — a stable device fingerprint so
// refresh-token rows can be scoped per device (multi-device sessions).
function getOrCreateDeviceId(): string | null {
  try {
    const KEY = "fnashha_device_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

const REFRESH_LOCK_NAME = "fnashha-auth-refresh";
const REFRESH_LOCK_KEY = "fnashha_refresh_lock";
const REFRESH_LOCK_TTL_MS = 15_000;
const REFRESH_LOCK_WAIT_MS = 100;
const REFRESH_LOCK_MAX_WAIT_MS = 20_000;
const REFRESH_CONTEXT_ID =
  globalThis.crypto?.randomUUID?.() ??
  `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;

type BrowserLockManager = {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
};

type LocalRefreshLock = {
  owner: string;
  expiresAt: number;
};

class RefreshLockTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for another browser context to finish refreshing");
  }
}

function getBrowserLockManager(): BrowserLockManager | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { locks?: BrowserLockManager }).locks ?? null;
}

function readStoredAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
  try {
    return {
      accessToken: localStorage.getItem("fnashha_token"),
      refreshToken: localStorage.getItem("fnashha_refresh_token"),
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function readLocalRefreshLock(): LocalRefreshLock | null {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) return null;
    const lock = JSON.parse(raw) as Partial<LocalRefreshLock>;
    if (typeof lock.owner !== "string" || typeof lock.expiresAt !== "number") return null;
    return { owner: lock.owner, expiresAt: lock.expiresAt };
  } catch {
    return null;
  }
}

function waitForRefreshLock(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLocalStorageRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + REFRESH_LOCK_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const now = Date.now();
    const existing = readLocalRefreshLock();
    if (!existing || existing.expiresAt <= now || existing.owner === REFRESH_CONTEXT_ID) {
      try {
        localStorage.setItem(
          REFRESH_LOCK_KEY,
          JSON.stringify({ owner: REFRESH_CONTEXT_ID, expiresAt: now + REFRESH_LOCK_TTL_MS }),
        );
        const confirmed = readLocalRefreshLock();
        if (confirmed?.owner === REFRESH_CONTEXT_ID) {
          try {
            return await work();
          } finally {
            try {
              if (readLocalRefreshLock()?.owner === REFRESH_CONTEXT_ID) {
                localStorage.removeItem(REFRESH_LOCK_KEY);
              }
            } catch {}
          }
        }
      } catch {
        // localStorage can be unavailable in privacy-restricted browser contexts.
        return work();
      }
    }
    await waitForRefreshLock(REFRESH_LOCK_WAIT_MS);
  }

  throw new RefreshLockTimeoutError();
}

async function withCrossTabRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const browserLocks = getBrowserLockManager();
  if (browserLocks) {
    return browserLocks.request(REFRESH_LOCK_NAME, { mode: "exclusive" }, work);
  }
  return withLocalStorageRefreshLock(work);
}

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  permissions: string[];
  login: (token: string, user: User, permissions?: string[], refreshToken?: string | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isHydrating: boolean;
  isCustomer: boolean;
  isTechnician: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isFounder: boolean;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);

  // Always mirrors the latest refresh token in a ref (not just localStorage)
  // so the unauthorized-handler closure below never reads a stale value.
  const refreshTokenRef = useRef<string | null>(null);
  // Dedupes concurrent 401s during the same refresh — every caller awaits
  // the same in-flight promise instead of firing N parallel /auth/refresh
  // requests (which would race each other through token rotation).
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("fnashha_token");
      const savedUserStr = localStorage.getItem("fnashha_user");
      const savedPermsStr = localStorage.getItem("fnashha_permissions");
      const savedRefreshToken = localStorage.getItem("fnashha_refresh_token");

      if (savedToken && savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          setToken(savedToken);
          setCurrentUser(savedUser);
          refreshTokenRef.current = savedRefreshToken || null;
          if (savedPermsStr) {
            setPermissions(JSON.parse(savedPermsStr));
          }
        } catch {
          try {
            localStorage.removeItem("fnashha_token");
            localStorage.removeItem("fnashha_user");
            localStorage.removeItem("fnashha_permissions");
            localStorage.removeItem("fnashha_refresh_token");
          } catch {}
        }
      }
    } catch {
      // iOS Safari in cross-origin iframes blocks localStorage — start unauthenticated
    }
    setIsHydrating(false);
  }, []);

  // Keep this tab in sync when another tab rotates the shared token or logs
  // out. This also lets raw web fetch callers use the newest access token.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "fnashha_refresh_token") {
        refreshTokenRef.current = event.newValue;
      }

      if (event.key === "fnashha_token") {
        if (event.newValue) {
          setToken(event.newValue);
        } else {
          setToken(null);
          setCurrentUser(null);
          setPermissions([]);
          refreshTokenRef.current = null;
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = useCallback((newToken: string, user: User, perms: string[] = [], newRefreshToken?: string | null) => {
    setToken(newToken);
    setCurrentUser(user);
    setPermissions(perms);
    refreshTokenRef.current = newRefreshToken || null;
    try {
      localStorage.setItem("fnashha_token", newToken);
      localStorage.setItem("fnashha_user", JSON.stringify(user));
      localStorage.setItem("fnashha_permissions", JSON.stringify(perms));
      if (newRefreshToken) localStorage.setItem("fnashha_refresh_token", newRefreshToken);
      else localStorage.removeItem("fnashha_refresh_token");
    } catch {}
  }, []);

  const logout = useCallback(() => {
    // Deactivate this device's push token (native no-ops on web, web no-ops
    // on native) so the signed-out device stops receiving notifications.
    void unregisterPushToken();
    void unregisterWebPushToken();

    // Best-effort revoke of this device's refresh token server-side. Fired
    // directly (bypassing the generated client) so it still fires even if
    // this runs after other cleanup has already cleared React state.
    const rt = refreshTokenRef.current;
    if (rt) {
      try {
        void fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {}
    }

    setToken(null);
    setCurrentUser(null);
    setPermissions([]);
    refreshTokenRef.current = null;
    try {
      localStorage.removeItem("fnashha_token");
      localStorage.removeItem("fnashha_user");
      localStorage.removeItem("fnashha_permissions");
      localStorage.removeItem("fnashha_refresh_token");
    } catch {}
  }, [token]);

  // Transparent access-token refresh: registered once so every request made
  // through the generated API client (any page, any hook) automatically
  // retries once after a silent refresh instead of bouncing the user to the
  // login page on every 15-minute access-token expiry.
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      const knownRefreshToken = refreshTokenRef.current;
      const beforeCoordination = readStoredAuthTokens();
      const currentRefreshToken = beforeCoordination.refreshToken || knownRefreshToken;
      const currentAccessToken = beforeCoordination.accessToken;
      if (beforeCoordination.refreshToken && beforeCoordination.refreshToken !== knownRefreshToken) {
        refreshTokenRef.current = beforeCoordination.refreshToken;
        if (currentAccessToken) {
          setToken(currentAccessToken);
          return currentAccessToken;
        }
      }

      const rt = currentRefreshToken;
      if (!rt) return null;

      if (!refreshInFlightRef.current) {
        refreshInFlightRef.current = withCrossTabRefreshLock(async () => {
          try {
            // Another tab may have completed rotation while this tab was
            // waiting for the browser-wide lock. Adopt those tokens instead
            // of submitting the already-rotated refresh token.
            const latest = readStoredAuthTokens();
            if (latest.refreshToken !== rt && latest.accessToken) {
              refreshTokenRef.current = latest.refreshToken;
              setToken(latest.accessToken);
              return latest.accessToken;
            }

            const deviceId = getOrCreateDeviceId();
            const res = await fetch(`${API_BASE}/api/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: latest.refreshToken || rt, deviceId }),
            });
            if (!res.ok) {
              // A context without the browser lock may still observe a
              // rotation completed by another context immediately after its
              // last token read. Adopt that pair instead of logging out.
              const afterFailure = readStoredAuthTokens();
              if (
                afterFailure.refreshToken &&
                afterFailure.refreshToken !== (latest.refreshToken || rt) &&
                afterFailure.accessToken
              ) {
                refreshTokenRef.current = afterFailure.refreshToken;
                setToken(afterFailure.accessToken);
                return afterFailure.accessToken;
              }
              // This context was the one that performed the refresh, so a
              // 401 is a genuine invalid/expired/revoked refresh-token
              // failure rather than another tab winning. Other failures are
              // left retryable and do not destroy an otherwise valid session.
              if (res.status === 401) logout();
              return null;
            }
            const data = await res.json();
            const newAccessToken: string = data.accessToken || data.token;
            const newRefreshToken: string | undefined = data.refreshToken;
            refreshTokenRef.current = newRefreshToken || null;
            setToken(newAccessToken);
            try {
              localStorage.setItem("fnashha_token", newAccessToken);
              if (newRefreshToken) localStorage.setItem("fnashha_refresh_token", newRefreshToken);
            } catch {}
            return newAccessToken;
          } catch (error) {
            if (error instanceof RefreshLockTimeoutError) {
              const latest = readStoredAuthTokens();
              if (latest.accessToken && latest.refreshToken && latest.refreshToken !== rt) {
                refreshTokenRef.current = latest.refreshToken;
                setToken(latest.accessToken);
                return latest.accessToken;
              }
            }
            return null;
          }
        }).finally(() => {
          refreshInFlightRef.current = null;
        });
      }
      return refreshInFlightRef.current;
    });
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = useCallback(
    (key: string): boolean => {
      if (!currentUser) return false;
      // Founder has all permissions
      if ((currentUser as any).isFounder) return true;
      if (currentUser.role === "super_admin") return true;
       // Wildcard authority is reserved for Founder / super_admin. A stale
       // localStorage value must not make a regular employee's UI appear
       // authorized after the server has removed an unsafe grant.
       if ((currentUser as any).isFounder || (currentUser.role as string) === "super_admin") {
         if (permissions.includes("*")) return true;
       }
      return permissions.includes(key);
    },
    [currentUser, permissions]
  );

  const value: AuthContextType = {
    currentUser,
    token,
    permissions,
    login,
    logout,
    isAuthenticated: !!token && !!currentUser,
    isHydrating,
    isCustomer: currentUser?.role === "customer",
    isTechnician: currentUser?.role === "technician",
    isAdmin: currentUser?.role === "admin" || currentUser?.role === "super_admin",
    isSuperAdmin: currentUser?.role === "super_admin",
    isFounder: (currentUser as any)?.isFounder === true,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
