/**
 * Capacitor Native Bridge
 * =======================
 * Initialises native-only Capacitor plugins and patches the API base URL
 * so all relative /api/... calls resolve against the deployed server
 * when the app runs as a native Android / iOS build.
 *
 * This module is imported ONCE from main.tsx (tree-shaken in pure-web
 * builds when VITE_API_URL is not set).
 *
 * How API routing works in Capacitor:
 *   Web browser  →  BASE_URL == "/"  →  relative fetch works (same origin)
 *   Android APK  →  origin is "https://localhost" (WebView)
 *   iOS IPA      →  origin is "capacitor://localhost"
 *
 * In both native cases relative /api/... calls would hit the WebView host,
 * not the real server.  setBaseUrl() in custom-fetch.ts fixes this by
 * prepending the absolute server URL before every fetch.
 */

import { setBaseUrl } from "@workspace/api-client-react";
import { initPushNotifications } from "./push-notifications";
import { navigateFromPush } from "./push-navigation";

const VITE_API_URL = import.meta.env.VITE_API_URL as string | undefined;

/**
 * Returns true when running inside a Capacitor native shell (Android / iOS).
 * In a regular browser this is always false.
 */
export function isNative(): boolean {
  return (
    typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform === "function" &&
    (window as unknown as { Capacitor: { isNativePlatform: () => boolean } })
      .Capacitor.isNativePlatform()
  );
}

/**
 * Initialise all native Capacitor plugins.
 * Safe to call in a web browser — every import is guarded by isNative().
 */
export async function initCapacitor(): Promise<void> {
  if (!isNative()) return;

  if (VITE_API_URL) {
    setBaseUrl(VITE_API_URL);
  } else {
    console.warn(
      "[Capacitor] VITE_API_URL is not set. " +
        "API calls will fail in native builds. " +
        "Set VITE_API_URL in .env.capacitor before building."
    );
  }

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Default });
    await StatusBar.setBackgroundColor({ color: "#16a34a" });
  } catch {
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {
  }

  await initPushNotifications(
    (title, body, data) => {
      console.info("[Push] Foreground notification:", { title, body, data });
      window.dispatchEvent(
        new CustomEvent("fnashha:push-foreground", { detail: { title, body, data } })
      );
    },
    (data) => {
      console.info("[Push] Notification tapped:", data);
      navigateFromPush(data);
    }
  );
}
