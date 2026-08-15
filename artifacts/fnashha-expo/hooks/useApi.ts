/**
 * API helpers for the Fnashha Expo app.
 *
 * - apiFetch<T>()    — plain fetch (call with explicit token)
 * - useAuthedFetch() — hook that binds the current auth token automatically
 * - apiUrl()         — builds a full URL from a path (re-exported from api-base)
 * - setRefreshHandler() — re-exported from api-base; registered by AuthContext
 */

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl, getRefreshHandler } from '@/hooks/api-base';

export { apiUrl, getApiBase, resolveMediaUrl, setRefreshHandler } from '@/hooks/api-base';

// ─── apiFetch ────────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string | null; _isRetry?: boolean },
): Promise<T> {
  const { token, _isRetry, ...init } = options ?? {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });

  // Transparent refresh on 401 — mirrors the web app's setUnauthorizedHandler.
  // Only retry once (_isRetry guard) to avoid infinite loops.
  if (res.status === 401 && !_isRetry) {
    const handler = getRefreshHandler();
    if (handler) {
      const freshToken = await handler();
      if (freshToken) {
        return apiFetch<T>(path, { ...options, token: freshToken, _isRetry: true });
      }
    }
  }

  if (!res.ok) {
    // Backend returns { error: "..." }; fall back to .message for other shapes.
    const errorBody = await res.json().catch(() => null);
    const message =
      (errorBody as any)?.error ??
      (errorBody as any)?.message ??
      res.statusText ??
      `API error ${res.status}`;
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Returns an apiFetch bound to the current auth token.
 * Use inside components/hooks.
 */
export function useAuthedFetch() {
  const { accessToken } = useAuth();
  return useCallback(
    <T>(path: string, options?: RequestInit) =>
      apiFetch<T>(path, { ...options, token: accessToken }),
    [accessToken],
  );
}

/**
 * Uploads a file (multipart/form-data) with auth.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string | null,
  _isRetry = false,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401 && !_isRetry) {
    const handler = getRefreshHandler();
    if (handler) {
      const freshToken = await handler();
      if (freshToken) return apiUpload<T>(path, formData, freshToken, true);
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const message =
      (errorBody as any)?.error ??
      (errorBody as any)?.message ??
      res.statusText ??
      `Upload error ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
