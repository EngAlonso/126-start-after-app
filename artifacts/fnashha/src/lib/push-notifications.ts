/**
 * Push Notifications Bridge
 * =========================
 * Wraps @capacitor/push-notifications for Android and iOS.
 *
 * Web (PWA) uses the Web Push API (VAPID) — separate flow, not covered here.
 * All functions are safe to call in a web browser (they no-op when not native).
 *
 * Setup needed before calling initPushNotifications():
 *  Android → google-services.json must be placed in android/app/
 *  iOS     → GoogleService-Info.plist must be placed in ios/App/App/
 *
 * Flow:
 *  1. initPushNotifications() — request permission + register with FCM/APNs
 *  2. Token received → sendTokenToBackend() → POST /api/push-tokens
 *  3. Foreground notification → onForegroundPush handler
 *  4. Notification tap → onPushActionPerformed handler → navigate to screen
 */

import { isNative } from "./capacitor-bridge";
import { API_BASE } from "./api-config";

// ─── NOTIFICATION PAYLOAD ───────────────────────────────────────────────────

export interface PushNotificationData {
  type?: string;
  requestId?: string;
  technicianName?: string;
  customerName?: string;
  senderName?: string;
  price?: string;
  serviceTitle?: string;
}

export type ForegroundPushHandler = (
  title: string,
  body: string,
  data: PushNotificationData
) => void;

export type PushActionHandler = (data: PushNotificationData) => void;

// ─── TOKEN REGISTRATION ─────────────────────────────────────────────────────

function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem("fnashha_token");
  } catch {
    return null;
  }
}

async function sendTokenToBackend(token: string, platform: "android" | "ios"): Promise<void> {
  try {
    const authToken = getStoredAuthToken();
    await fetch(`${API_BASE}/api/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ token, platform }),
    });
  } catch (err) {
    console.warn("[Push] Failed to register token with backend:", err);
  }
}

// ─── PLATFORM DETECTION ─────────────────────────────────────────────────────

function getPlatform(): "android" | "ios" {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("android") ? "android" : "ios";
}

// ─── INIT ───────────────────────────────────────────────────────────────────

/**
 * Initialise push notifications for native (Android/iOS) builds.
 * Requests permission, registers the device with FCM/APNs, and
 * sends the token to the Fnashha backend for storage.
 *
 * @param onForeground - Called when a notification arrives while app is open.
 * @param onTap        - Called when the user taps a notification.
 */
export async function initPushNotifications(
  onForeground?: ForegroundPushHandler,
  onTap?: PushActionHandler
): Promise<void> {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      console.info("[Push] Permission denied by user");
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      console.info("[Push] FCM/APNs token registered:", token.value.slice(0, 20) + "...");
      await sendTokenToBackend(token.value, getPlatform());
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] Registration error:", err.error);
    });

    if (onForeground) {
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        const data = (notification.data ?? {}) as PushNotificationData;
        onForeground(
          notification.title ?? "",
          notification.body ?? "",
          data
        );
      });
    }

    if (onTap) {
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = (action.notification.data ?? {}) as PushNotificationData;
        onTap(data);
      });
    }
  } catch (err) {
    console.error("[Push] Failed to initialise push notifications:", err);
  }
}

/**
 * Remove the current device's push token from the backend.
 * Call on logout so the user no longer receives push notifications
 * on this device.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const authToken = getStoredAuthToken();

    await PushNotifications.removeAllListeners();
    await fetch(`${API_BASE}/api/push-tokens/mine`, {
      method: "DELETE",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  } catch (err) {
    console.warn("[Push] Failed to unregister push token:", err);
  }
}
