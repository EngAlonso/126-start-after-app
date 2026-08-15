/**
 * Push Notification Deep-Link Router
 * ====================================
 * Resolves a notification payload to the correct in-app route based on the
 * notification type and the currently logged-in user's role.
 *
 * Architecture:
 *  • registerPushNavigator() — called once by <PushNavigatorRegistrar> which
 *    lives inside the React tree (inside WouterRouter + AuthProvider).  It
 *    supplies the wouter navigate fn and a role getter so this module never
 *    needs to touch React hooks itself.
 *
 *  • navigateFromPush(data) — called from the Capacitor bridge's onTap
 *    callback whenever the user taps a push notification.
 *
 * This file has zero UI and zero business logic.  It is pure routing glue.
 */

import type { PushNotificationData } from "./push-notifications";

// ─── Navigator registry ──────────────────────────────────────────────────────

type NavigateFn = (to: string) => void;
type RoleFn = () => string | null | undefined;

let _navigate: NavigateFn | null = null;
let _getRole: RoleFn | null = null;

/**
 * Register the wouter navigate function and a role getter.
 * Called by <PushNavigatorRegistrar> on every mount / role change.
 */
export function registerPushNavigator(navigate: NavigateFn, getRole: RoleFn): void {
  _navigate = navigate;
  _getRole = getRole;
}

// ─── Route resolver ──────────────────────────────────────────────────────────

/**
 * Given a push notification payload, return the correct in-app path for the
 * currently logged-in user, or null if no mapping exists.
 *
 * Notification type → destination route mapping
 * ─────────────────────────────────────────────
 * new_request        (technician) → /technician/requests/:id
 * new_offer          (customer)   → /customer/requests/:id
 * offer_accepted     (technician) → /technician/requests/:id
 * new_message        (customer)   → /customer/chat/:requestId
 * new_message        (technician) → /technician/chat/:requestId
 * request_completed  (customer)   → /customer/requests/:id
 * request_completed  (technician) → /technician/requests/:id
 * price_adjustment   (customer)   → /customer/requests/:id
 * price_adjustment   (technician) → /technician/requests/:id
 * price_adjustment   (admin)      → /admin/requests/:id
 * support_reply      (customer)   → /customer/support
 * support_reply      (technician) → /technician/support
 * support_reply      (admin)      → /admin/support
 * announcement       (customer)   → /customer/notifications
 * announcement       (technician) → /technician/notifications
 * announcement       (admin)      → /admin/notifications
 */
export function resolveDeepLink(data: PushNotificationData): string | null {
  const { type, requestId } = data;
  const role = _getRole?.();

  switch (type) {
    case "new_message":
      if (requestId) {
        if (role === "customer")   return `/customer/chat/${requestId}`;
        if (role === "technician") return `/technician/chat/${requestId}`;
      }
      return null;

    case "new_request":
      if (requestId && role === "technician") return `/technician/requests/${requestId}`;
      return null;

    case "new_offer":
      if (requestId && role === "customer") return `/customer/requests/${requestId}`;
      return null;

    case "offer_accepted":
      if (requestId && role === "technician") return `/technician/requests/${requestId}`;
      return null;

    case "request_completed":
      if (requestId) {
        if (role === "customer")   return `/customer/requests/${requestId}`;
        if (role === "technician") return `/technician/requests/${requestId}`;
      }
      return null;

    case "price_adjustment":
      if (role === "admin" || role === "super_admin") {
        return requestId ? `/admin/requests/${requestId}` : `/admin/requests`;
      }
      if (requestId) {
        if (role === "customer")   return `/customer/requests/${requestId}`;
        if (role === "technician") return `/technician/requests/${requestId}`;
      }
      return null;

    case "support_reply":
      if (role === "customer")                          return `/customer/support`;
      if (role === "technician")                         return `/technician/support`;
      if (role === "admin" || role === "super_admin")    return `/admin/support`;
      return null;

    case "platform_credit_added":
    case "platform_credit_paid":
      if (requestId && role === "technician") return `/technician/requests/${requestId}`;
      if (role === "admin" || role === "super_admin") return `/admin/loyalty/credits`;
      return null;

    case "announcement":
      if (role === "customer")                          return `/customer/notifications`;
      if (role === "technician")                        return `/technician/notifications`;
      if (role === "admin" || role === "super_admin")   return `/admin/notifications`;
      return null;

    default:
      return null;
  }
}

// ─── Navigate from push tap ──────────────────────────────────────────────────

/**
 * Resolve the deep-link destination for the given push payload and navigate
 * to it using the registered wouter navigator.
 *
 * Falls back to a full-page redirect if called before React mounts (e.g. a
 * cold-start tap that opens the app).
 *
 * Safe to call on any platform — returns immediately if no route is found.
 */
export function navigateFromPush(data: PushNotificationData): void {
  const path = resolveDeepLink(data);
  if (!path) {
    console.info("[PushNav] No deep-link route for payload:", data);
    return;
  }

  if (_navigate) {
    console.info("[PushNav] Navigating to:", path);
    _navigate(path);
  } else {
    // Cold-start: React not yet mounted — use full navigation as fallback.
    // The app will mount and render the correct page.
    console.info("[PushNav] Fallback navigation to:", path);
    window.location.href = path;
  }
}
