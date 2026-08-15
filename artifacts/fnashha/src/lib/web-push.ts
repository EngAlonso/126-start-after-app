/**
 * Web Push Bridge (Firebase Cloud Messaging for browsers / installed PWA)
 * ========================================================================
 * Extends the EXISTING notification pipeline to browsers and installed PWAs.
 * Reuses, unchanged:
 *   - the push_tokens table (via POST /api/push-tokens, platform="web")
 *   - notification-service.ts on the backend (no backend sending logic here)
 *   - the SSE hooks (use-user-events.ts / use-admin-events.ts) — untouched
 *   - push-navigation.ts's navigateFromPush()/resolveDeepLink() for routing
 *   - the "fnashha:push-foreground" custom event + <PushForegroundToast/>
 *     already used by the native (Capacitor) flow
 *
 * This module does NOT touch push-notifications.ts (native/Capacitor) or
 * capacitor-bridge.ts. It is the "separate flow" that push-notifications.ts's
 * top comment explicitly deferred.
 *
 * Flow:
 *  1. initWebPushServiceWorker() — called once from main.tsx. Registers the
 *     merged service worker (public/firebase-messaging-sw.js) and wires up
 *     onMessage() for foreground delivery. Safe no-op on native/unsupported.
 *  2. requestWebPushPermission() — called ONLY when appropriate (after the
 *     user logs in, with a short delay — see <WebPushRegistrar/>). Requests
 *     Notification permission, retrieves the FCM token, and stores it via
 *     the existing /api/push-tokens endpoint with platform="web".
 *  3. unregisterWebPushToken() — called on logout, mirroring the native
 *     unregisterPushToken().
 */

import { API_BASE } from "./api-config";
import { isNative } from "./capacitor-bridge";
import type { PushNotificationData } from "./push-notifications";

// ─── Support detection ──────────────────────────────────────────────────────

export function isWebPushSupported(): boolean {
  try {
    if (isNative()) return false;
    if (typeof window === "undefined") return false;
    const hasSW = "serviceWorker" in navigator;
    const hasPushManager = "PushManager" in window;
    const hasNotification = "Notification" in window;
    console.log("[TRACE-SW] isWebPushSupported():", { hasSW, hasPushManager, hasNotification });
    return hasSW && hasPushManager && hasNotification;
  } catch (err) {
    // iOS Safari in cross-origin iframes or insecure contexts can throw
    // SecurityError/TypeError when checking for notification-related globals.
    console.log("[TRACE-SW] isWebPushSupported(): caught exception →", (err as Error)?.message ?? err, "→ returning false");
    return false;
  }
}

// ─── Firebase web config (fetched from backend — see firebase-config.ts) ────

interface FirebaseWebConfig {
  supported: boolean;
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  vapidKey?: string;
}

let _configPromise: Promise<FirebaseWebConfig> | null = null;

function fetchFirebaseWebConfig(): Promise<FirebaseWebConfig> {
  if (!_configPromise) {
    console.log("[TRACE-SW] fetchFirebaseWebConfig(): fetching", `${API_BASE}/api/firebase-web-config`);
    _configPromise = fetch(`${API_BASE}/api/firebase-web-config`)
      .then((r) => r.json())
      .then((data) => {
        console.log("[TRACE-SW] fetchFirebaseWebConfig(): response =", JSON.stringify(data));
        return data;
      })
      .catch((err) => {
        console.error("[TRACE-SW] fetchFirebaseWebConfig(): FETCH FAILED", err);
        return { supported: false };
      });
  }
  return _configPromise;
}

// ─── Token registration (reuses the existing /api/push-tokens endpoint) ────

function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem("fnashha_token");
  } catch {
    return null;
  }
}

async function sendTokenToBackend(token: string): Promise<void> {
  console.log("[TRACE-SW] sendTokenToBackend(): calling POST /api/push-tokens");
  try {
    const authToken = getStoredAuthToken();
    const res = await fetch(`${API_BASE}/api/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ token, platform: "web" }),
    });
    console.log("[TRACE-SW] sendTokenToBackend(): POST /api/push-tokens status =", res.status);
  } catch (err) {
    console.warn("[WebPush] Failed to register token with backend:", err);
  }
}

// ─── Module state ────────────────────────────────────────────────────────────

type ForegroundHandler = (title: string, body: string, data: PushNotificationData) => void;

let _swRegistration: ServiceWorkerRegistration | null = null;
let _messaging: import("firebase/messaging").Messaging | null = null;
let _vapidKey: string | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Registers the merged service worker and sets up foreground message
 * delivery. Call once from main.tsx. Safe no-op on native / unsupported
 * browsers (graceful skip).
 */
export async function initWebPushServiceWorker(onForeground?: ForegroundHandler): Promise<void> {
  console.log("[TRACE-SW] initWebPushServiceWorker(): called");
  const supported = isWebPushSupported();
  console.log("[TRACE-SW] initWebPushServiceWorker(): isWebPushSupported() =", supported);
  if (!supported) {
    console.log("[TRACE-SW] initWebPushServiceWorker(): EARLY RETURN — not supported");
    return;
  }
  if (_initPromise) {
    console.log("[TRACE-SW] initWebPushServiceWorker(): already initialized (returning existing promise)");
    return _initPromise;
  }

  _initPromise = (async () => {
    try {
      console.log("[TRACE-SW] Registering service worker: /firebase-messaging-sw.js");
      _swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      console.log("[TRACE-SW] Service worker registered:", _swRegistration.scope);

      console.log("[TRACE-SW] Waiting for navigator.serviceWorker.ready...");
      const readyReg = await navigator.serviceWorker.ready;
      console.log("[TRACE-SW] navigator.serviceWorker.ready resolved — scope:", readyReg.scope);

      console.log("[TRACE-SW] Fetching Firebase web config from backend...");
      const config = await fetchFirebaseWebConfig();
      console.log("[TRACE-SW] Firebase config received — supported:", config.supported, "| vapidKey present:", !!config.vapidKey);

      if (!config.supported || !config.vapidKey) {
        console.warn("[TRACE-SW] STOPPING HERE — config.supported=", config.supported, "config.vapidKey=", config.vapidKey ?? "MISSING");
        console.warn("[WebPush] Firebase web config not set on the server — web push disabled.");
        return;
      }
      _vapidKey = config.vapidKey;
      console.log("[TRACE-SW] _vapidKey set. Importing firebase/app and firebase/messaging...");

      const { initializeApp, getApps, getApp } = await import("firebase/app");
      const { getMessaging, onMessage } = await import("firebase/messaging");
      console.log("[TRACE-SW] Firebase modules imported. getApps().length =", getApps().length);

      const app = getApps().length
        ? getApp()
        : initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          });
      _messaging = getMessaging(app);
      console.log("[TRACE-SW] Firebase app initialized. _messaging set. onMessage wiring up...");

      onMessage(_messaging, (payload) => {
        const data = (payload.data ?? {}) as PushNotificationData;
        const title = payload.notification?.title ?? "";
        const body = payload.notification?.body ?? "";
        if (onForeground) {
          onForeground(title, body, data);
        } else {
          window.dispatchEvent(
            new CustomEvent("fnashha:push-foreground", { detail: { title, body, data } })
          );
        }
      });

      console.log("[TRACE-SW] initWebPushServiceWorker(): COMPLETE — all steps done.");
    } catch (err) {
      console.warn("[WebPush] Service worker / messaging init failed:", err);
    }
  })();

  return _initPromise;
}

/**
 * Requests Notification permission (only call this when appropriate — e.g.
 * shortly after login, not on page load) and, if granted, retrieves the FCM
 * token and stores it via the existing /api/push-tokens endpoint.
 *
 * Returns "granted" | "denied" | "unsupported" | "error".
 */
export async function requestWebPushPermission(): Promise<
  "granted" | "denied" | "unsupported" | "error"
> {
  console.log("[TRACE-PERM] requestWebPushPermission(): called");

  const supported = isWebPushSupported();
  console.log("[TRACE-PERM] isWebPushSupported() =", supported);
  if (!supported) {
    console.log("[TRACE-PERM] EARLY RETURN — not supported");
    return "unsupported";
  }

  try {
    console.log("[TRACE-PERM] Calling initWebPushServiceWorker()...");
    await initWebPushServiceWorker();
    console.log("[TRACE-PERM] initWebPushServiceWorker() resolved. State: _messaging=", !!_messaging, "_vapidKey=", !!_vapidKey, "_swRegistration=", !!_swRegistration);

    if (!_messaging || !_vapidKey || !_swRegistration) {
      console.warn("[TRACE-PERM] EARLY RETURN — _messaging/_vapidKey/_swRegistration not set. Returning 'unsupported'.");
      console.warn("[TRACE-PERM] Details: _messaging=", _messaging, "_vapidKey=", _vapidKey, "_swRegistration=", _swRegistration);
      return "unsupported";
    }

    const permBefore = Notification.permission;
    console.log("[TRACE-PERM] Notification.permission BEFORE requestPermission() =", permBefore);

    if (Notification.permission === "denied") {
      console.log("[TRACE-PERM] EARLY RETURN — Notification.permission is already 'denied'");
      return "denied";
    }

    console.log("[TRACE-PERM] >>> CALLING Notification.requestPermission() NOW <<<");
    const permission = await Notification.requestPermission();
    console.log("[TRACE-PERM] Notification.requestPermission() resolved:", permission);
    console.log("[TRACE-PERM] Notification.permission AFTER requestPermission() =", Notification.permission);

    if (permission !== "granted") {
      console.log("[TRACE-PERM] Permission not granted — returning 'denied'");
      return "denied";
    }

    console.log("[TRACE-PERM] Permission granted! Calling getToken()...");
    const { getToken } = await import("firebase/messaging");
    console.log("[TRACE-PERM] getToken() imported. Calling with vapidKey + swRegistration...");
    const token = await getToken(_messaging, {
      vapidKey: _vapidKey,
      serviceWorkerRegistration: _swRegistration,
    });
    console.log("[TRACE-PERM] getToken() resolved. Token present:", !!token, "| Token prefix:", token ? token.slice(0, 20) + "..." : "null");

    if (!token) {
      console.warn("[TRACE-PERM] getToken() returned empty token — returning 'error'");
      return "error";
    }

    console.log("[TRACE-PERM] Calling sendTokenToBackend()...");
    await sendTokenToBackend(token);
    console.log("[TRACE-PERM] sendTokenToBackend() done — returning 'granted'");
    return "granted";
  } catch (err) {
    console.warn("[WebPush] Failed to request permission / get token:", err);
    console.warn("[TRACE-PERM] EXCEPTION caught:", err);
    return "error";
  }
}

/**
 * Deactivates this browser's push token on logout, mirroring the native
 * unregisterPushToken(). Reuses the same DELETE /api/push-tokens/mine route
 * and the backend's existing deactivateToken() cleanup logic.
 */
export async function unregisterWebPushToken(): Promise<void> {
  if (!isWebPushSupported()) return;

  try {
    const authToken = getStoredAuthToken();
    await fetch(`${API_BASE}/api/push-tokens/mine`, {
      method: "DELETE",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  } catch (err) {
    console.warn("[WebPush] Failed to unregister push token:", err);
  }
}
