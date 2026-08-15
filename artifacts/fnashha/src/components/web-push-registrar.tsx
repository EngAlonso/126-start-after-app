/**
 * WebPushRegistrar
 * =================
 * Shows a visible "Enable Notifications" banner. Never auto-prompts.
 * Notification.requestPermission() is called ONLY from the button click.
 *
 * Banner visibility is computed on every render from the LIVE
 * Notification.permission, so it works correctly even if the user resets
 * browser permissions between sessions (not just on login).
 *
 * Also handles notification-click routing:
 *   - Focused window: SW postMessage → navigateFromPush()
 *   - Cold start:     ?pushData= query param → navigateFromPush()
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { navigateFromPush } from "@/lib/push-navigation";
import { isWebPushSupported, requestWebPushPermission } from "@/lib/web-push";
import type { PushNotificationData } from "@/lib/push-notifications";

export function WebPushRegistrar() {
  const { currentUser, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // permissionTick exists only to force a re-render after the user clicks
  // "Enable" and Notification.permission changes (it is not a React observable).
  const [permissionTick, setPermissionTick] = useState(0);
  const silentRegDone = useRef(false);

  // ── isWebPushSupported is computed once on mount — never on every render.
  // Calling "PushManager" in window / "Notification" in window during render
  // throws SecurityError on iOS Safari in cross-origin iframe contexts.
  const supported = useMemo(() => isWebPushSupported(), []);

  // ── livePermission: read safely on every render (after the useMemo guard) ──
  const livePermission: string = useMemo(() => {
    try {
      return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
    } catch {
      return "unsupported";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionTick]);

  const showBanner =
    isAuthenticated &&
    !!currentUser &&
    supported &&
    livePermission === "default" &&
    !dismissed;

  console.log("[WebPush] render:", {
    isAuthenticated,
    currentUserId: currentUser?.id ?? null,
    supported,
    livePermission,
    dismissed,
    showBanner,
    permissionTick,
    loading,
  });

  // ── Side-effect: silent token re-registration when already granted ────────
  useEffect(() => {
    console.log("[WebPush] effect [auth changed]:", {
      isAuthenticated,
      currentUserId: currentUser?.id ?? null,
      supported,
      livePermission,
    });

    if (!isAuthenticated || !currentUser || !supported) {
      console.log("[WebPush] effect: skip — not authenticated or not supported");
      return;
    }

    if (livePermission === "granted" && !silentRegDone.current) {
      silentRegDone.current = true;
      console.log("[WebPush] effect: permission already granted — silent token re-registration");
      requestWebPushPermission()
        .then((r) => console.log("[WebPush] silent re-registration result:", r))
        .catch((err) => console.warn("[WebPush] silent re-registration error:", err));
    } else if (livePermission === "default") {
      console.log("[WebPush] effect: permission is 'default' — banner should be visible if not dismissed");
    } else if (livePermission === "denied") {
      console.log("[WebPush] effect: permission is 'denied' — banner stays hidden");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser]);

  // ── Button click handler ──────────────────────────────────────────────────
  async function handleEnableClick() {
    console.log("[WebPush] ▶ Enable button CLICKED");
    console.log("[WebPush]   document.hasFocus()     =", document.hasFocus());
    console.log("[WebPush]   window.isSecureContext   =", window.isSecureContext);
    console.log("[WebPush]   Notification.permission  =", typeof Notification !== "undefined" ? Notification.permission : "n/a", "(BEFORE request)");

    setLoading(true);

    try {
      console.log("[WebPush]   Calling requestWebPushPermission()...");
      const result = await requestWebPushPermission();
      console.log("[WebPush]   requestWebPushPermission() →", result);
      console.log("[WebPush]   Notification.permission  =", typeof Notification !== "undefined" ? Notification.permission : "n/a", "(AFTER request)");

      // Trigger a re-render so showBanner recomputes from the new livePermission.
      setPermissionTick((t) => t + 1);
    } catch (err) {
      console.error("[WebPush] handleEnableClick error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Dismiss handler ───────────────────────────────────────────────────────
  function handleDismiss() {
    console.log("[WebPush] ✕ Dismiss clicked — hiding banner for this session");
    setDismissed(true);
  }

  // ── Focused-window click routing via SW postMessage ───────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "fnashha:notification-click") {
        navigateFromPush((event.data.data ?? {}) as PushNotificationData);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // ── Cold-start click routing via ?pushData= query param ──────────────────
  //
  // Why two effects instead of one:
  //
  // On a cold launch (app was closed, user taps a notification), the SW opens
  // the app at /?pushData=<encoded>.  At first mount, AuthProvider has not yet
  // run its localStorage hydration effect — because parent effects fire AFTER
  // child effects in React.  At that moment currentUser is null, so
  // _getRole() returns null, resolveDeepLink() returns null, and navigation is
  // silently abandoned.
  //
  // Fix: read and clean the URL immediately on mount (effect 1, deps=[]), then
  // defer the navigation until currentUser is actually available (effect 2,
  // deps=[currentUser]).  A ref guards against double-navigation.

  const pendingPushRef = useRef<PushNotificationData | null>(null);
  const coldStartNavigatedRef = useRef(false);

  // Effect 1 — runs once on mount: extract pushData from URL and clean it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("pushData");
    if (!raw) return;

    try {
      pendingPushRef.current = JSON.parse(decodeURIComponent(raw)) as PushNotificationData;
    } catch {}

    // Clean the URL immediately so the encoded payload never shows in the
    // address bar or gets re-processed on a subsequent re-render.
    params.delete("pushData");
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  // Effect 2 — runs whenever currentUser changes: process pending cold-start
  // push data once the user is known (auth has hydrated from localStorage).
  useEffect(() => {
    if (!pendingPushRef.current || coldStartNavigatedRef.current) return;
    if (!currentUser) return; // wait for auth to hydrate
    coldStartNavigatedRef.current = true;
    const data = pendingPushRef.current;
    pendingPushRef.current = null;
    navigateFromPush(data);
  }, [currentUser]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!showBanner) return null;

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: "#1e293b",
        color: "#f1f5f9",
        borderRadius: "0.75rem",
        padding: "0.75rem 1rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        maxWidth: "calc(100vw - 2rem)",
        width: "max-content",
        fontSize: "0.9rem",
      }}
    >
      <span style={{ fontSize: "1.3rem" }}>🔔</span>
      <span style={{ flex: 1 }}>فعّل الإشعارات لتلقي تحديثات طلباتك</span>
      <button
        onClick={handleEnableClick}
        disabled={loading}
        style={{
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.4rem 0.9rem",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: "0.85rem",
          opacity: loading ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {loading ? "جاري التفعيل..." : "تفعيل"}
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          color: "#94a3b8",
          border: "none",
          cursor: "pointer",
          fontSize: "1.1rem",
          lineHeight: 1,
          padding: "0 0.25rem",
        }}
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}
