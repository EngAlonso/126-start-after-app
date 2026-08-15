/// Every path here mirrors an existing, unmodified backend route.
/// See `artifacts/api-server/src/routes/*.ts` for the source of truth —
/// this file must never drift from it without a matching backend change.
class ApiEndpoints {
  ApiEndpoints._();

  // ── Auth ───────────────────────────────────────────────────────────────
  static const String registerCustomer = '/auth/register/customer';
  static const String registerTechnician = '/auth/register/technician';
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String logoutAll = '/auth/logout-all';
  static const String me = '/auth/me';

  // ── Catalog (technician registration reference data) ───────────────────
  static const String services = '/services';
  static const String governorates = '/governorates';
  static const String areas = '/areas';

  // ── Realtime (SSE) ───────────────────────────────────────────────────
  // Query-param token auth (?token=<jwt>) — native EventSource/HTTP clients
  // on Android/iOS cannot send custom Authorization headers on a streamed
  // GET, so the backend added this auth path specifically for mobile.
  static const String userEvents = '/events';
  static const String adminEvents = '/admin/events';

  // ── Service requests ──────────────────────────────────────────────────
  // Authenticated: customer creates, technician/admin lists/views.
  static const String requests = '/requests';

  // ── Offers (Phase 6) ────────────────────────────────────────────────────
  // GET  → list offers for a request (customer/technician/admin).
  // POST → customer accepts one offer, rejecting the rest.
  static String requestOffers(int requestId) => '$requests/$requestId/offers';
  static String selectOffer(int requestId, int offerId) =>
      '$requests/$requestId/offers/$offerId/select';

  // Public technician profile (rating, review count, completed jobs) — used
  // to enrich the offer details screen beyond what the offers list returns.
  static String technicianPublicProfile(int userId) =>
      '/technicians/$userId/public-profile';

  // Full technician profile (services, areas, approval status, years of
  // experience, rating) — no-auth public route, used by the Technician
  // Profile screen (Phase 11F) to show the technician's own catalog data.
  static String technicianFullProfile(int userId) =>
      '/technicians/$userId/profile';

  // ── Chat / Messages (Phase 7) ─────────────────────────────────────────
  // GET  → list all conversations for the current user.
  static const String conversations = '/conversations';

  // GET  → all messages for a request (with sender info).
  // POST → send a new message { content, type?, imageUrl? }.
  static String requestMessages(int requestId) =>
      '$requests/$requestId/messages';

  // PATCH → mark all received messages in a request as read.
  static String requestMessagesReadAll(int requestId) =>
      '$requests/$requestId/messages/read-all';

  // ── Notifications (Phase 8) ──────────────────────────────────────────
  static const String notifications = '/notifications';
  static const String notificationsReadAll = '/notifications/read-all';
  static String notificationRead(int id) => '/notifications/$id/read';

  // ── Loyalty / Wallet (Phase 9) ───────────────────────────────────────
  // Customer-facing endpoints only — admin routes are web-only.
  static const String loyaltyWallet = '/loyalty/wallet';
  static const String loyaltyTransactions = '/loyalty/transactions';
  static const String loyaltyReferral = '/loyalty/referral-code';
  static const String loyaltyConfig = '/loyalty/config';
  static const String loyaltyCalculate = '/loyalty/calculate';
  static const String loyaltyRedeem = '/loyalty/redeem';

  // ── Technician Points (Phase 11A / 11D) ────────────────────────────────
  static const String pointsBalance = '/points/balance';
  // GET → paginated ledger of the technician's own point transactions.
  // Fixed backend page size of 50; response is a bare array (no pagination
  // envelope), so `hasMore` must be inferred from a full page coming back.
  static const String pointsTransactions = '/points/transactions';

  // ── Technician Job Management (Phase 11B) ─────────────────────────────
  // GET  → completed requests for the logged-in technician.
  static const String myCompletedRequests = '$requests/my-completed';
  // POST → technician signals they have finished work (→ waiting_approval).
  static String requestCompletion(int id) => '$requests/$id/request-completion';
  // POST → technician proposes a revised price (→ price_change_requested).
  static String priceAdjustment(int id) => '$requests/$id/price-adjustment';

  // ── Technician Offers (Phase 11A) ──────────────────────────────────────
  // POST → submit a new offer on a request.
  // GET  → list all offers on a request (shared with customer phase 6).
  static String submitOffer(int requestId) => '$requests/$requestId/offers';
  // PATCH → edit own pending offer.
  static String updateOffer(int requestId, int offerId) =>
      '$requests/$requestId/offers/$offerId';

  // ── Users / Profile (Phase 10) ───────────────────────────────────────
  static String user(int id) => '/users/$id';
  static const String founderSettings = '/founder/settings';

  // ── Uploads ──────────────────────────────────────────────────────────
  // Local disk storage, used by customer/technician-facing features (chat
  // images, request photos, profile photos, ID documents, voice notes).
  static const String uploadUser = '/upload/user';
  // Cloudinary, admin CMS only.
  static const String uploadCms = '/upload';

  // ── Technician service modification requests ──────────────────────────
  // POST → technician submits; GET → technician's own list.
  static const String techModificationRequests =
      '/technicians/modification-requests';

  // ── CMS / Branding ────────────────────────────────────────────────────
  // Public — no auth required. Returns all CMS key-value pairs.
  // Consumed by CmsRepository → cmsBrandingProvider.
  static const String cmsSettings = '/cms/settings';
}
