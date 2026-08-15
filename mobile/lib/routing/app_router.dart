import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/providers/auth_providers.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/auth/screens/public_home_screen.dart';
import '../features/auth/screens/register_choice_screen.dart';
import '../features/auth/screens/register_customer_screen.dart';
import '../features/auth/screens/register_technician_screen.dart';
import '../features/auth/screens/technician_pending_screen.dart';
import '../features/chat/screens/chat_screen.dart';
import '../features/chat/screens/conversations_screen.dart';
import '../features/home/screens/customer_home_screen.dart';
import '../features/home/screens/home_shell_screen.dart';
import '../features/intro/intro_provider.dart';
import '../features/intro/intro_screen.dart';
import '../features/notifications/screens/notifications_screen.dart';
import '../features/profile/screens/change_password_screen.dart';
import '../features/profile/screens/edit_profile_screen.dart';
import '../features/profile/screens/founder_settings_screen.dart';
import '../features/profile/screens/profile_screen.dart';
import '../features/requests/screens/create_request_screen.dart';
import '../features/support/screens/support_ticket_screen.dart';
import '../features/requests/screens/my_requests_screen.dart';
import '../features/requests/screens/offer_detail_screen.dart';
import '../features/requests/screens/offers_screen.dart';
import '../features/requests/screens/request_detail_screen.dart';
import '../features/requests/screens/request_success_screen.dart';
import '../features/services/screens/services_screen.dart';
import '../features/technician/screens/tech_job_detail_screen.dart';
import '../features/technician/screens/tech_my_jobs_screen.dart';
import '../features/technician/screens/tech_request_detail_screen.dart';
import '../features/technician/screens/tech_requests_screen.dart';
import '../features/technician/screens/tech_service_modification_screen.dart';
import '../features/technician/screens/tech_wallet_screen.dart';
import '../features/technician/screens/technician_home_screen.dart';
import '../features/wallet/screens/referral_screen.dart';
import '../features/wallet/screens/wallet_screen.dart';
import '../models/offer_model.dart';
import '../models/user_model.dart';
import 'change_notifier_adapter.dart';
import 'route_paths.dart';

/// Public routes reachable while unauthenticated: login plus the whole
/// registration flow. Any other location bounces an unauthenticated user
/// to `/welcome`, and an authenticated user is bounced *away* from all of
/// these (see `_redirectForAuthenticated`) since they make no sense once
/// logged in.
const _publicAuthRoutes = {
  RoutePaths.publicHome,
  RoutePaths.login,
  RoutePaths.registerChoice,
  RoutePaths.registerCustomer,
  RoutePaths.registerTechnician,
  RoutePaths.registerTechnicianPending,
};

final appRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = GoRouterRefreshListenable(ref);

  return GoRouter(
    initialLocation: RoutePaths.splash,
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final authState     = ref.read(authControllerProvider);
      final introComplete = ref.read(introCompleteProvider);
      final isAtSplash = state.matchedLocation == RoutePaths.splash;

      return authState.when(
        // While auth is still loading always stay on (or return to) splash.
        loading: () => isAtSplash ? null : RoutePaths.splash,
        error: (_, __) => RoutePaths.login,
        data: (data) {
          // Auth resolved — but keep the user on splash until intro finishes.
          if (!introComplete && isAtSplash) return null;

          // ── Normal auth routing ─────────────────────────────────────────
          return switch (data) {
            Authenticated(user: final user) =>
                _redirectForAuthenticated(user, state.matchedLocation),
            Unauthenticated() =>
                _publicAuthRoutes.contains(state.matchedLocation)
                    ? null
                    : RoutePaths.publicHome,
          };
        },
      );
    },
    routes: [
      GoRoute(path: RoutePaths.splash,     builder: (_, __) => const IntroScreen()),
      GoRoute(path: RoutePaths.publicHome, builder: (_, __) => const PublicHomeScreen()),
      GoRoute(path: RoutePaths.login,      builder: (_, __) => const LoginScreen()),
      GoRoute(
        path:    RoutePaths.registerChoice,
        builder: (_, __) => const RegisterChoiceScreen(),
      ),
      GoRoute(
        path:    RoutePaths.registerCustomer,
        builder: (_, __) => const RegisterCustomerScreen(),
      ),
      GoRoute(
        path:    RoutePaths.registerTechnician,
        builder: (_, __) => const RegisterTechnicianScreen(),
      ),
      GoRoute(
        path:    RoutePaths.registerTechnicianPending,
        builder: (_, __) => const TechnicianPendingScreen(),
      ),
      GoRoute(
        path:    RoutePaths.customerHome,
        builder: (_, __) => const CustomerHomeScreen(),
      ),
      GoRoute(
        path:    RoutePaths.technicianHome,
        builder: (_, __) => const TechnicianHomeScreen(),
      ),
      GoRoute(
        path:    RoutePaths.technicianRequests,
        builder: (_, __) => const TechRequestsScreen(),
      ),
      GoRoute(
        path: '/technician/requests/:id',
        builder: (context, state) => TechRequestDetailScreen(
          requestId: int.parse(state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path:    RoutePaths.technicianMyJobs,
        builder: (_, __) => const TechMyJobsScreen(),
      ),
      GoRoute(
        path: '/technician/jobs/:id',
        builder: (context, state) => TechJobDetailScreen(
          requestId: int.parse(state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path:    RoutePaths.adminHome,
        builder: (_, state) => const HomeShellScreen(role: 'admin'),
      ),
      // ── Services catalogue ───────────────────────────────────────────────
      GoRoute(
        path:    RoutePaths.services,
        builder: (_, __) => const ServicesScreen(),
      ),
      // ── Create request flow ──────────────────────────────────────────────
      GoRoute(
        path: RoutePaths.createRequest,
        builder: (_, state) {
          final serviceIdParam = state.uri.queryParameters['serviceId'];
          final serviceId = serviceIdParam != null
              ? int.tryParse(serviceIdParam)
              : null;
          return CreateRequestScreen(initialServiceId: serviceId);
        },
      ),
      GoRoute(
        path: RoutePaths.createRequestSuccess,
        builder: (_, state) => RequestSuccessScreen(
          requestId: state.extra is int ? state.extra as int : 0,
        ),
      ),
      // ── My Requests ──────────────────────────────────────────────────────
      GoRoute(
        path:    RoutePaths.myRequests,
        builder: (_, __) => const MyRequestsScreen(),
      ),
      GoRoute(
        path: '/requests/:id',
        builder: (context, state) => RequestDetailScreen(
          requestId: int.parse(state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/requests/:id/offers',
        builder: (context, state) => OffersScreen(
          requestId: int.parse(state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/requests/:id/offers/:offerId',
        builder: (context, state) => OfferDetailScreen(
          requestId:    int.parse(state.pathParameters['id']!),
          offerId:      int.parse(state.pathParameters['offerId']!),
          initialOffer: state.extra is OfferModel ? state.extra as OfferModel : null,
        ),
      ),
      GoRoute(
        path:    RoutePaths.notifications,
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(
        path:    RoutePaths.wallet,
        builder: (_, __) => const WalletScreen(),
      ),
      GoRoute(
        path:    RoutePaths.referral,
        builder: (_, __) => const ReferralScreen(),
      ),
      GoRoute(
        path:    RoutePaths.technicianWallet,
        builder: (_, __) => const TechWalletScreen(),
      ),
      GoRoute(
        path:    RoutePaths.techServiceModification,
        builder: (_, __) => const TechServiceModificationScreen(),
      ),
      GoRoute(
        path:    RoutePaths.supportTicket,
        builder: (_, __) => const SupportTicketScreen(),
      ),
      GoRoute(
        path:    RoutePaths.profile,
        builder: (_, __) => const ProfileScreen(),
      ),
      GoRoute(
        path:    RoutePaths.editProfile,
        builder: (_, __) => const EditProfileScreen(),
      ),
      GoRoute(
        path:    RoutePaths.changePassword,
        builder: (_, __) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path:    RoutePaths.founderSettings,
        builder: (_, __) => const FounderSettingsScreen(),
      ),
      GoRoute(
        path:    RoutePaths.conversations,
        builder: (_, __) => const ConversationsScreen(),
      ),
      GoRoute(
        path: '/requests/:id/chat',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ChatScreen(
            requestId:   int.parse(state.pathParameters['id']!),
            serviceName: extra?['serviceName'] as String?,
            status:      extra?['status']      as String?,
            otherName:   extra?['otherName']   as String?,
            otherImage:  extra?['otherImage']  as String?,
          );
        },
      ),
    ],
  );
});

String? _redirectForAuthenticated(UserModel user, String currentLocation) {
  final homePath = switch (user.role) {
    'technician' => RoutePaths.technicianHome,
    'admin' || 'super_admin' => RoutePaths.adminHome,
    _ => RoutePaths.customerHome,
  };
  final atOwnHome  = currentLocation == homePath;
  final atEntryRoute =
      currentLocation == RoutePaths.splash ||
      _publicAuthRoutes.contains(currentLocation);
  if (atOwnHome)     return null;
  if (atEntryRoute)  return homePath;
  return null;
}

/// Bridges Riverpod state changes into something `go_router`'s
/// `refreshListenable` can observe.
class GoRouterRefreshListenable extends ChangeNotifierAdapter {
  GoRouterRefreshListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
    ref.listen(introCompleteProvider,  (_, __) => notifyListeners());
  }
}
