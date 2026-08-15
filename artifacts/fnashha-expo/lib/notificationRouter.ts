/**
 * Centralized push notification routing — Fnashha Expo app.
 *
 * This is the SINGLE source of truth for mapping a push notification's
 * data payload → the in-app route the user should land on after tapping.
 *
 * Used in three places:
 *   1. app/_layout.tsx — notification tap listener (background / cold-start)
 *   2. app/notifications.tsx — in-app notification list taps
 *
 * Never duplicate this logic elsewhere.
 */

/**
 * Returns the Expo Router path that corresponds to the given FCM data payload
 * and optional user role. Returns null when there is no navigable destination.
 *
 * All values in `data` are strings (FCM data fields are always strings).
 */
export function getRouteFromPushData(
  data: Record<string, string | undefined>,
  userRole?: string,
): string | null {
  const type      = data.type;
  const requestId = data.requestId;
  const ticketId  = data.ticketId;

  switch (type) {
    // ── Requests / Offers ────────────────────────────────────────────────────
    case 'new_request':
    case 'new_offer':
    case 'offer_accepted':
    case 'request_completed':
    case 'request_cancelled':
    case 'price_change_requested':
    case 'price_approved':
    case 'price_rejected':
    case 'waiting_approval':
      return requestId ? `/requests/${requestId}` : '/notifications';

    // ── Chat ─────────────────────────────────────────────────────────────────
    case 'new_message':
      return requestId ? `/messages/${requestId}` : '/messages';

    // ── Platform Credits ──────────────────────────────────────────────────────
    case 'platform_credit_added':
    case 'platform_credit_paid':
      return requestId ? `/requests/${requestId}` : '/notifications';

    // ── Loyalty / Wallet ──────────────────────────────────────────────────────
    case 'coins_earned':
    case 'referral_reward':
    case 'campaign_reward':
      // Role-aware: technician has a different wallet route than customer.
      if (userRole === 'technician') return '/(technician)/wallet';
      return '/customer-wallet';

    // ── Ratings ───────────────────────────────────────────────────────────────
    case 'new_rating':
      return '/tech-ratings';

    // ── Support ───────────────────────────────────────────────────────────────
    case 'support_reply':
      return ticketId ? `/support/${ticketId}` : '/support';

    // ── Announcements / Fallback ──────────────────────────────────────────────
    case 'announcement':
    default:
      return '/notifications';
  }
}

/**
 * Maps a DB notification record (from the in-app notification list) to a route.
 * Role-aware — different users navigate to different places for the same type.
 * Replaces the old `getNotifPath` function that was local to notifications.tsx.
 */
export function getRouteFromDbNotification(
  type: string,
  relatedId: number | null,
  role: string,
  title?: string,
): string | null {
  switch (type) {
    case 'new_request':
      return role === 'technician' && relatedId ? `/requests/${relatedId}` : null;

    case 'technician_selected':
    case 'status_change':
      // Loyalty rewards and admin-added technician points use the existing
      // status_change DB type, but should open the wallet rather than a
      // request detail screen.
      if (
        title &&
        (
          title.includes('كوينز') ||
          title.includes('مكافأة') ||
          title.includes('نقاط') ||
          title.includes('رصيدك بواسطة الإدارة')
        )
      ) {
        return role === 'technician' ? '/(technician)/wallet' : '/customer-wallet';
      }
      // The rating creation reuses the status_change type with a specific title.
      if (type === 'status_change' && role === 'technician' && title === 'تقييم جديد') {
        return '/tech-ratings';
      }
      return relatedId ? `/requests/${relatedId}` : null;

    case 'new_offer':
    case 'offer_accepted':
    case 'request_completed':
    case 'request_cancelled':
      return relatedId ? `/requests/${relatedId}` : null;

    case 'new_message':
      return relatedId ? `/messages/${relatedId}` : null;

    case 'platform_credit_added':
    case 'platform_credit_paid':
      return role === 'technician' && relatedId ? `/requests/${relatedId}` : null;

    case 'support_reply':
      return relatedId ? `/support/${relatedId}` : '/support';

    case 'announcement':
      return '/notifications';

    default:
      return null;
  }
}
