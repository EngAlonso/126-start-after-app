/**
 * Push notification lifecycle management — Fnashha Expo app.
 *
 * Responsibilities:
 *   • Request OS notification permission after the user logs in.
 *   • Retrieve the native device push token (FCM on Android, APNs on iOS).
 *   • Register the token with the backend — idempotent, skips when unchanged.
 *   • Re-register automatically when FCM rotates the token.
 *   • Expose `deregisterPushTokens()` for the logout flow.
 *
 * Constraints:
 *   • Never crashes the app — push is additive, not on the critical path.
 *   • Only runs on native (Android / iOS). Returns immediately on web.
 *   • Must be called inside AuthProvider.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/hooks/useApi';

// Versioned key: bump when the token format changes to force re-registration.
const PUSH_TOKEN_KEY = 'fnashha_push_token_v1';

// ── Standalone helpers ────────────────────────────────────────────────────────

/** POST a token to the backend (upsert — safe to call multiple times). */
async function registerToken(
  token: string,
  platform: 'android' | 'ios',
  accessToken: string,
): Promise<void> {
  await apiFetch('/api/push-tokens', {
    method: 'POST',
    token: accessToken,
    body: JSON.stringify({ token, platform }),
  });
}

/**
 * Deregister ALL push tokens for the currently authenticated user.
 *
 * Call this BEFORE calling `logout()` while the access token is still valid.
 * Passing `token` deactivates only that specific token; omitting it deactivates
 * all tokens for the user (correct for logout / account deletion).
 */
export async function deregisterPushTokens(
  accessToken: string,
  specificToken?: string,
): Promise<void> {
  try {
    const body = specificToken ? JSON.stringify({ token: specificToken }) : undefined;
    await apiFetch('/api/push-tokens/mine', {
      method: 'DELETE',
      token: accessToken,
      ...(body ? { body } : {}),
    });
  } catch {
    // Best-effort — a stale DB token is harmless; the backend deactivates it
    // automatically when FCM returns 404/410 on the next delivery attempt.
  } finally {
    // Always clear local storage so the next login starts fresh.
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => null);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the complete push token lifecycle for the logged-in user.
 * Mount once inside a component that is a child of AuthProvider.
 *
 * Flow:
 *   login → permission request → token retrieval → backend registration
 *        → (token rotation listener) → logout / cleanup
 */
export function usePushNotifications(): void {
  const { user, accessToken } = useAuth();
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Web uses the SSE real-time path — no native push needed.
    if (Platform.OS === 'web') return;
    // Wait until the user is authenticated.
    if (!user?.id || !accessToken) return;

    let cancelled = false;
    let tokenSub: Notifications.Subscription | null = null;

    const run = async () => {
      // Prevent overlapping setup calls (e.g. when accessToken refreshes mid-run).
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        // ── 1. Permission ───────────────────────────────────────────────────
        const { status: existing } = await Notifications.getPermissionsAsync();
        let granted = existing === 'granted';

        if (existing === 'undetermined') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowDisplayInCarPlay: false,
              allowCriticalAlerts: false,
              provideAppNotificationSettings: false,
            },
          });
          granted = status === 'granted';
        }

        if (!granted) {
          // Denied or restricted — nothing to do.
          // User can re-enable in device Settings; the next app launch retries.
          return;
        }

        if (cancelled) return;

        // ── 2. Token retrieval ──────────────────────────────────────────────
        // getDevicePushTokenAsync() returns:
        //   Android → FCM registration token  (used directly with FCM HTTP v1)
        //   iOS     → APNs device token hex   (routed to APNs sender on backend)
        const { data: newToken } = await Notifications.getDevicePushTokenAsync();
        if (!newToken || cancelled) return;

        const platform = Platform.OS as 'android' | 'ios';

        // ── 3. Register (skip when token unchanged) ──────────────────────────
        const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (stored !== newToken) {
          await registerToken(newToken, platform, accessToken);
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, newToken);
        }

        // ── 4. Token rotation listener ───────────────────────────────────────
        // FCM rotates tokens after app reinstall, token invalidation, or
        // project changes. Re-register immediately so the backend stays current.
        tokenSub = Notifications.addPushTokenListener(async ({ data: rotated }) => {
          if (cancelled || !accessToken) return;
          try {
            await registerToken(rotated, platform, accessToken);
            await AsyncStorage.setItem(PUSH_TOKEN_KEY, rotated);
          } catch {
            // Non-fatal — the next launch will retry.
          }
        });
      } catch (err) {
        // Never crash the app over push setup.
        if (__DEV__) console.warn('[Push] Setup error:', err);
      } finally {
        inFlightRef.current = false;
      }
    };

    run();

    return () => {
      cancelled = true;
      tokenSub?.remove();
    };
    // Re-run if the user id changes (different account after re-login) or
    // the token refreshes. accessToken changes too often (every 15 min refresh)
    // but we guard internally with the stored-token equality check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
