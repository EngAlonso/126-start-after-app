/**
 * Low-level API primitives — no React, no AuthContext.
 *
 * Split out so that AuthContext.tsx can import apiUrl / setRefreshHandler
 * without creating a circular dependency with useApi.ts.
 */

import Constants from 'expo-constants';

export const getApiBase = (): string => {
  const configuredBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    Constants.expoConfig?.extra?.apiBaseUrl ??
    process.env.EXPO_PUBLIC_DOMAIN;

  if (configuredBaseUrl) {
    const normalizedUrl = configuredBaseUrl.trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(normalizedUrl)
      ? normalizedUrl
      : `https://${normalizedUrl}`;
  }

  return ''; // same-origin on web fallback
};

export const apiUrl = (path: string): string => `${getApiBase()}${path}`;

/**
 * API upload responses use relative `/uploads/...` paths when files are stored
 * locally. Native Image components need the API origin for those paths.
 */
export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : apiUrl(path);
}

// ─── Global refresh handler ──────────────────────────────────────────────────
// Registered by AuthProvider once on mount.  apiFetch calls it whenever a
// request returns 401 so expired access tokens are refreshed transparently.

export type RefreshHandler = () => Promise<string | null>;
let _refreshHandler: RefreshHandler | null = null;

export function setRefreshHandler(handler: RefreshHandler | null): void {
  _refreshHandler = handler;
}

export function getRefreshHandler(): RefreshHandler | null {
  return _refreshHandler;
}
