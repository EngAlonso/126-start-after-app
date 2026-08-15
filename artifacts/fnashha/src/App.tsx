import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { PageBackgroundsProvider } from "@/contexts/page-backgrounds-context";

import Landing from "@/pages/landing";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import RegisterCustomer from "@/pages/auth/register-customer";
import RegisterTechnician from "@/pages/auth/register-technician";

import CustomerLayout from "@/pages/customer/layout";
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerRequests from "@/pages/customer/requests";
import CustomerNewRequest from "@/pages/customer/new-request";
import CustomerRequestDetail from "@/pages/customer/request-detail";
import CustomerChat from "@/pages/customer/chat";
import CustomerInbox from "@/pages/customer/inbox";
import CustomerProfile from "@/pages/customer/profile";
import CustomerSupport from "@/pages/customer/support";
import CustomerWallet from "@/pages/customer/wallet";
import CustomerReferral from "@/pages/customer/referral";
import TechnicianProfilePage from "@/pages/customer/technician-profile";

import TechnicianLayout from "@/pages/technician/layout";
import TechnicianDashboard from "@/pages/technician/dashboard";
import TechnicianRequests from "@/pages/technician/requests";
import TechnicianOffers from "@/pages/technician/offers";
import TechnicianRequestDetail from "@/pages/technician/request-detail";
import TechnicianChat from "@/pages/technician/chat";
import TechnicianInbox from "@/pages/technician/inbox";
import TechnicianWallet from "@/pages/technician/wallet";
import TechnicianCompleted from "@/pages/technician/completed";
import TechnicianProfile from "@/pages/technician/profile";
import TechnicianSupport from "@/pages/technician/support";
import TechnicianReviews from "@/pages/technician/reviews";

import AdminLayout from "@/pages/admin/layout";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminTechnicians from "@/pages/admin/technicians";
import AdminTechnicianDetail from "@/pages/admin/technician-detail";
import AdminRequests from "@/pages/admin/requests";
import AdminRequestDetail from "@/pages/admin/request-detail";
import AdminServices from "@/pages/admin/services";
import AdminLocations from "@/pages/admin/locations";
import AdminCommissionRanges from "@/pages/admin/commission-ranges";
import AdminPoints from "@/pages/admin/points";
import AdminSupport from "@/pages/admin/support";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminCms from "@/pages/admin/cms";
import AdminHero from "@/pages/admin/hero";
import AdminBanners from "@/pages/admin/banners";
import AdminOffers from "@/pages/admin/offers";
import AdminSeoPages from "@/pages/admin/seo-pages";
import AdminStaff from "@/pages/admin/staff";
import AdminLogs from "@/pages/admin/logs";
import AdminRejectedTechnicians from "@/pages/admin/rejected-technicians";
import AdminConversations from "@/pages/admin/conversations";
import AdminDatabase from "@/pages/admin/database";
import AdminSystemMaintenance from "@/pages/admin/system-maintenance";
import AdminNotifications from "@/pages/admin/notifications";
import AdminBranding from "@/pages/admin/branding";
import AdminQrLinks from "@/pages/admin/qr-links";
import AdminPageBackgrounds from "@/pages/admin/page-backgrounds";
import AdminLoyaltyDashboard from "@/pages/admin/loyalty-dashboard";
import AdminLoyaltyWallets from "@/pages/admin/loyalty-wallets";
import AdminLoyaltyWalletDetail from "@/pages/admin/loyalty-wallet-detail";
import AdminLoyaltyCredits from "@/pages/admin/loyalty-credits";
import AdminLoyaltyReferrals from "@/pages/admin/loyalty-referrals";
import AdminLoyaltyCampaigns from "@/pages/admin/loyalty-campaigns";
import AdminLoyaltyCampaignHistory from "@/pages/admin/loyalty-campaign-history";
import AdminLoyaltyReports from "@/pages/admin/loyalty-reports";
import AdminIntroScreens from "@/pages/admin/intro-screens";
import AdminInvoices from "@/pages/admin/invoices";
import AdminInvoiceView from "@/pages/admin/invoice-view";
import InvoiceVerify from "@/pages/invoice-verify";
import FounderSettings from "@/pages/founder/settings";
import QrPage from "@/pages/qr";
import ReferralRedirect from "@/pages/auth/referral-redirect";

import HowItWorks from "@/pages/how-it-works";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import RefundPolicy from "@/pages/refund-policy";
import FAQ from "@/pages/faq";
import Contact from "@/pages/contact";
import OffersPage from "@/pages/offers";
import ServicesPage from "@/pages/services";
import ServiceLocationSeoPage from "@/pages/service-location-seo";
import NotFound from "@/pages/not-found";
import NotificationsPage from "@/pages/notifications";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaFabButton } from "@/components/pwa-fab-button";
import { PushNavigatorRegistrar } from "@/components/push-navigator-registrar";
import { PushForegroundToast } from "@/components/push-foreground-toast";
import { WebPushRegistrar } from "@/components/web-push-registrar";
import IntroSlideshowOverlay from "@/components/intro-slideshow-overlay";
import { SeoManager } from "@/lib/seo";
import { AdminNavigationTracker } from "@/components/admin-back-button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedCustomer({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isCustomer, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isCustomer) return <Redirect to="/login" />;
  return <>{children}</>;
}

function ProtectedTechnician({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isTechnician, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isTechnician) return <Redirect to="/login" />;
  return <>{children}</>;
}

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isAdmin) return <Redirect to="/login" />;
  return <>{children}</>;
}

function ProtectedSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSuperAdmin, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isSuperAdmin) return <Redirect to="/admin" />;
  return <>{children}</>;
}

function ProtectedFounder({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isFounder, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isFounder) return <Redirect to="/admin" />;
  return <>{children}</>;
}

function Router() {
  return (
    <>
    <PushNavigatorRegistrar />
    <WebPushRegistrar />
    <SeoManager />
    <AdminNavigationTracker />
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/register/customer" component={RegisterCustomer} />
      <Route path="/register/technician" component={RegisterTechnician} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/refund-policy" component={RefundPolicy} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route path="/offers" component={OffersPage} />
      <Route path="/services" component={ServicesPage} />
      <Route path="/services/:serviceSlug/:locationSlug">
        {(params) => (
          <ServiceLocationSeoPage
            serviceSlug={params.serviceSlug}
            locationSlug={params.locationSlug}
          />
        )}
      </Route>
      <Route path="/qr" component={QrPage} />
      {/* Short referral link — /r/CODE → /register/customer?ref=CODE */}
      <Route path="/r/:code">
        {(params) => <ReferralRedirect code={params.code} />}
      </Route>

      {/* Customer routes */}
      <Route path="/customer">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerDashboard />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/requests">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerRequests />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/requests/new">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerNewRequest />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/requests/:id">
        {(params) => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerRequestDetail id={params.id} />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/chat/:requestId">
        {(params) => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerChat requestId={params.requestId} />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/inbox">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerInbox />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/profile">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerProfile />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/support">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerSupport />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/technician/:id">
        {(params) => (
          <ProtectedCustomer>
            <CustomerLayout>
              <TechnicianProfilePage id={params.id} />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/technician/:id/from/:requestId">
        {(params) => (
          <ProtectedCustomer>
            <CustomerLayout>
              <TechnicianProfilePage id={params.id} requestId={params.requestId} />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/wallet">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerWallet />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/referral">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <CustomerReferral />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>
      <Route path="/customer/notifications">
        {() => (
          <ProtectedCustomer>
            <CustomerLayout>
              <NotificationsPage />
            </CustomerLayout>
          </ProtectedCustomer>
        )}
      </Route>

      {/* Technician routes */}
      <Route path="/technician">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianDashboard />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/requests">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianRequests />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/offers">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianOffers />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/requests/:id">
        {(params) => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianRequestDetail id={params.id} />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/chat/:requestId">
        {(params) => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianChat requestId={params.requestId} />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/inbox">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianInbox />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/wallet">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianWallet />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/completed">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianCompleted />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/profile">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianProfile />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/support">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianSupport />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/notifications">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <NotificationsPage />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>
      <Route path="/technician/reviews">
        {() => (
          <ProtectedTechnician>
            <TechnicianLayout>
              <TechnicianReviews />
            </TechnicianLayout>
          </ProtectedTechnician>
        )}
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/users">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminUsers />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/technicians">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminTechnicians />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/technicians/:id">
        {(params) => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminTechnicianDetail id={params.id} />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/requests">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminRequests />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/requests/:id">
        {(params) => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminRequestDetail id={params.id} />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/services">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminServices />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/locations">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLocations />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/commission-ranges">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminCommissionRanges />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/points">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminPoints />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/support">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminSupport />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/analytics">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminAnalytics />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/cms">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminCms />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/hero">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminHero />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/banners">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminBanners />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/offers">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminOffers />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/seo-pages">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminSeoPages />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/page-backgrounds">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminPageBackgrounds />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/intro-screens">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminIntroScreens />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/staff">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminStaff />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/logs">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLogs />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/rejected-technicians">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminRejectedTechnicians />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/conversations">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminConversations />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/database">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminDatabase />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/system-maintenance">
        {() => (
          <ProtectedSuperAdmin>
            <AdminLayout>
              <AdminSystemMaintenance />
            </AdminLayout>
          </ProtectedSuperAdmin>
        )}
      </Route>
      <Route path="/admin/notifications">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminNotifications />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/branding">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminBranding />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/qr-links">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminQrLinks />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>

      <Route path="/admin/loyalty">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyDashboard />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/wallets">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyWallets />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/wallets/:userId">
        {(params) => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyWalletDetail userId={params.userId} />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/credits">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyCredits />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/referrals">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyReferrals />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/campaigns">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyCampaigns />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/campaigns/history">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyCampaignHistory />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/loyalty/reports">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminLoyaltyReports />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>

      {/* Admin invoice routes */}
      <Route path="/admin/invoices">
        {() => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminInvoices />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>
      <Route path="/admin/invoices/:id">
        {(params) => (
          <ProtectedAdmin>
            <AdminLayout>
              <AdminInvoiceView id={params.id} />
            </AdminLayout>
          </ProtectedAdmin>
        )}
      </Route>

      {/* Public invoice verification — no auth required */}
      <Route path="/invoice/verify/:invoiceNumber">
        {(params) => <InvoiceVerify invoiceNumber={params.invoiceNumber} />}
      </Route>

      {/* Founder-only settings — completely invisible to every other account */}
      <Route path="/founder/settings">
        {() => (
          <ProtectedFounder>
            <AdminLayout>
              <FounderSettings />
            </AdminLayout>
          </ProtectedFounder>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Intro slideshow overlay — shown at every app start, fades out once
              auth hydration completes and at least one slide has been displayed.
              Rendered inside AuthProvider so it can read isHydrating. */}
          <IntroSlideshowOverlay />
          <PageBackgroundsProvider>
          <BrandingProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
              <PwaInstallPrompt />
              <PwaFabButton />
              <PushForegroundToast />
            </TooltipProvider>
          </BrandingProvider>
          </PageBackgroundsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
