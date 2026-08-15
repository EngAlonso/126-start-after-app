/// Named path constants for `go_router`. Kept separate from
/// `app_router.dart` so screens can reference a route without importing
/// the router configuration itself.
class RoutePaths {
  RoutePaths._();

  static const splash      = '/';
  static const publicHome = '/welcome';
  static const login = '/login';
  static const registerChoice = '/register';
  static const registerCustomer = '/register/customer';
  static const registerTechnician = '/register/technician';
  static const registerTechnicianPending = '/register/technician/pending';

  // Role-specific home shells.
  static const customerHome = '/customer';
  static const technicianHome = '/technician';
  static const adminHome = '/admin';

  // ── Phase 4: Services module ──────────────────────────────────────────
  static const services = '/services';

  // ── Phase 4: Create request flow ──────────────────────────────────────
  // Optional query param: ?serviceId=<int>  (pre-selects the service)
  static const createRequest = '/create-request';
  static const createRequestSuccess = '/create-request/success';

  // ── Phase 5: My Requests module ─────────────────────────────────────────
  static const myRequests = '/requests';
  static String requestDetail(int id) => '/requests/$id';

  // ── Phase 6: Offers module ──────────────────────────────────────────────
  static String requestOffers(int requestId) => '/requests/$requestId/offers';
  static String offerDetail(int requestId, int offerId) => '/requests/$requestId/offers/$offerId';

  // ── Phase 7: Chat module ─────────────────────────────────────────────────
  static const conversations = '/conversations';
  static String chat(int requestId) => '/requests/$requestId/chat';

  // ── Phase 8: Notifications module ────────────────────────────────────────
  static const notifications = '/notifications';

  // ── Phase 9: Wallet module ────────────────────────────────────────────────
  static const wallet = '/wallet';

  // ── Phase 11A: Technician module — available requests ────────────────────
  static const technicianRequests = '/technician/requests';
  static String technicianRequestDetail(int id) => '/technician/requests/$id';

  // ── Phase 11B: Technician job management (assigned jobs) ─────────────────
  static const technicianMyJobs = '/technician/jobs';
  static String technicianJobDetail(int id) => '/technician/jobs/$id';

  // ── Phase 11D: Technician wallet (commission points) ──────────────────────
  static const technicianWallet = '/technician/wallet';

  // ── Phase 10: Profile & Settings module ──────────────────────────────────
  static const profile = '/profile';
  static const editProfile = '/profile/edit';
  static const changePassword = '/profile/change-password';
  static const founderSettings = '/profile/founder-settings';

  // ── Referral page (standalone, reachable from My Page dashboard card) ────
  static const referral = '/referral';

  // ── Technician service modification request ───────────────────────────────
  // Technicians cannot directly modify their services/areas; they submit
  // a modification request here for admin review.
  static const techServiceModification = '/technician/service-modification';

  // ── Support ticket ────────────────────────────────────────────────────────
  static const supportTicket = '/support/ticket';
}
