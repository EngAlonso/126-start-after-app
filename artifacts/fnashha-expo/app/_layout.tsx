import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from '@expo-google-fonts/cairo';
import { Stack, usePathname, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { PersistentTabBar } from '@/components/PersistentTabBar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ReferralProvider, useReferral } from '@/contexts/ReferralContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LocaleProvider, useLocale } from '@/contexts/LocaleContext';
import { useColors } from '@/hooks/useColors';
import { queryClient } from '@/lib/queryClient';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getRouteFromPushData } from '@/lib/notificationRouter';
import { apiFetch } from '@/hooks/useApi';
import { hasIntroPlayedThisSession } from '@/constants/intro';


SplashScreen.preventAutoHideAsync();

// ── Foreground notification handler ──────────────────────────────────────────
// Set at module level so it is registered before any notification can arrive,
// even during cold start. Controls what happens when a push arrives while the
// app is open (foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Android notification channel ──────────────────────────────────────────────
// Must be created BEFORE any notification arrives. Android 8+ silently
// discards messages sent to a channel that has not been registered on the device.
async function createAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('fnashha_default', {
    name: 'إشعارات فنشها',
    description: 'الإشعارات الرئيسية لتطبيق فنشها',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Role-based auth guard.
 *
 * Public routes (no auth required):
 *   /            — guest home (browse banners + services)
 *   /login       — login form
 *   /register    — customer registration
 *   /register-tech — technician registration
 *   /intro       — intro slideshow
 *   /services    — services list
 *   /services/*  — service detail (guests can browse; creating a request prompts login)
 *
 * Protected route groups:
 *   (customer)   — customer tab screens
 *   (technician) — technician tab screens
 *
 * Rules:
 *   • Not logged in + in (customer)/(technician) group → redirect to /
 *   • Logged in + on / or /login → redirect to role home
 */
function AuthGate({ onStartupReady }: { onStartupReady: () => void }) {
  const { user, isLoading } = useAuth();
  const { referralCode, isReady: referralReady, clearReferralCode } = useReferral();
  const { direction } = useLocale();
  const segments = useSegments();
  const router = useRouter();
  const colors = useColors();

  // ── Intro gate: show intro on every cold app launch ─────────────────────────
  // Must run before the auth guard so authenticated users also see the intro.
  const [introReady, setIntroReady] = useState(false);
  const introCheckRef = useRef(false);
  const introRouteRequestedRef = useRef(false);
  const startupReadyReportedRef = useRef(false);
  const referralRouteInFlightRef = useRef(false);

  useEffect(() => {
    if (isLoading || !referralReady) return; // wait for auth and referral URL restoration
    if (introCheckRef.current) return;       // one-shot: only check once per session
    introCheckRef.current = true;

    const seg0 = segments[0] as string | undefined;

    // Already on intro screen, or intro already played this session → no-op
    if (seg0 === 'intro' || hasIntroPlayedThisSession()) {
      setIntroReady(true);
      return;
    }

    // Fetch intro screens; navigate to /intro if any exist. The root gate is
    // the only owner of this decision; index.tsx must not race it with a
    // second intro request.
    apiFetch('/api/intro-screens')
      .then((screens: any) => {
        if (Array.isArray(screens) && screens.length > 0) {
          introRouteRequestedRef.current = true;
          router.replace('/intro' as any);
        }
        setIntroReady(true);
      })
      .catch(() => setIntroReady(true));   // network error → skip intro
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, referralReady]);

  // ── Push token registration / deregistration ────────────────────────────────
  // Only runs on native; no-op on web.
  usePushNotifications();

  // ── Notification tap tracking ────────────────────────────────────────────────
  // A response can arrive before the router/auth/intro startup sequence is
  // complete. Keep it in React state until the normal navigation stack is
  // ready, then send it through the same route mapper used for warm starts.
  const lastHandledIdRef = useRef<string | null>(null);
  const [pendingNotification, setPendingNotification] =
    useState<Notifications.NotificationResponse | null>(null);
  const notificationRouteInFlightRef = useRef<string | null>(null);
  const navigationState = useRootNavigationState();
  const navigationReady = Boolean(navigationState?.key);
  const pathname = usePathname();

  const queueNotification = useCallback(
    (response: Notifications.NotificationResponse) => {
      setPendingNotification(response);
    },
    [],
  );

  // ── Cold-start handler ───────────────────────────────────────────────────────
  // getLastNotificationResponseAsync() returns the notification that launched
  // the app from a killed state. Store it; the processing effect below waits
  // for auth, intro, and the router to be ready before navigating.
  useEffect(() => {
    if (isLoading) return; // wait for session restore to complete

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) queueNotification(response);
      })
      .catch(() => null);
  }, [isLoading, queueNotification]);

  // ── Background / foreground tap listener ────────────────────────────────────
  // addNotificationResponseReceivedListener fires when the user taps a push
  // notification while the app is backgrounded OR open in the foreground.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      queueNotification,
    );
    return () => sub.remove();
  }, [queueNotification]);

  // Process both cold-start and warm-start responses through the existing
  // destination mapper. There is intentionally no arbitrary timer here:
  // route processing is gated by actual readiness signals.
  useEffect(() => {
    if (
      isLoading ||
      !introReady ||
      !navigationReady ||
      segments[0] === 'intro' ||
      (introRouteRequestedRef.current && !hasIntroPlayedThisSession()) ||
      !pendingNotification
    ) {
      return;
    }

    const id = pendingNotification.notification.request.identifier;
    setPendingNotification(null);
    if (lastHandledIdRef.current === id) return;
    lastHandledIdRef.current = id;

    const data = (pendingNotification.notification.request.content.data ?? {}) as Record<
      string,
      string | undefined
    >;
    const route = getRouteFromPushData(data, user?.role);
    if (!route) return;

    // Keep the auth guard from replacing the notification route with a role
    // home route during the same startup transition.
    notificationRouteInFlightRef.current = route;
    try {
      router.push(route as any);
    } catch {
      notificationRouteInFlightRef.current = null;
    }
  }, [
    introReady,
    isLoading,
    navigationReady,
    pathname,
    pendingNotification,
    router,
    segments,
    user?.role,
  ]);

  // Clear the startup guard once the requested destination is actually active.
  useEffect(() => {
    if (
      notificationRouteInFlightRef.current &&
      pathname === notificationRouteInFlightRef.current
    ) {
      notificationRouteInFlightRef.current = null;
    }
  }, [pathname]);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  // Waits for introReady so the intro check has a chance to run before we
  // redirect an authenticated user away from the root screen.
  useEffect(() => {
    if (
      startupReadyReportedRef.current ||
      isLoading ||
      !referralReady ||
      !introReady ||
      (introRouteRequestedRef.current && segments[0] !== 'intro')
    ) {
      return;
    }
    startupReadyReportedRef.current = true;
    onStartupReady();
  }, [isLoading, referralReady, introReady, onStartupReady, segments]);

  useEffect(() => {
    if (isLoading || !referralReady || !introReady) return;

    const seg0 = segments[0] as string | undefined;

    // Never interrupt the intro screen — let it finish and call router.replace('/').
    if (seg0 === 'intro') return;

    // Avoid replacing the notification destination with a role home while a
    // cold-start notification is being handed to the router.
    if (notificationRouteInFlightRef.current) return;

    // An authenticated user is not a new referee. Clear a tapped code rather
    // than carrying it into a future registration or creating an attribution.
    if (user && referralCode) {
      void clearReferralCode();
      if (
        seg0 === 'r' ||
        !seg0 ||
        seg0 === 'login' ||
        seg0 === 'register' ||
        seg0 === 'register-select'
      ) {
        router.replace(user.role === 'technician' ? '/(technician)' : '/(customer)');
      }
      return;
    }

    // A guest referral deep link is held in ReferralContext/AsyncStorage.
    // Route to the existing customer registration screen only after the
    // existing intro and auth startup gates have completed.
    if (!user && referralCode) {
      if (seg0 === 'login' || seg0 === 'register' || seg0 === 'register-select') {
        return;
      }
      if (!referralRouteInFlightRef.current) {
        referralRouteInFlightRef.current = true;
        router.replace('/register' as any);
      }
      return;
    }

    // The intro route may have been requested by the startup gate before the
    // segment update arrived. Once intro has completed, allow normal auth
    // routing to continue.
    if (introRouteRequestedRef.current && !hasIntroPlayedThisSession()) return;
    introRouteRequestedRef.current = false;

    const inCustomer    = seg0 === '(customer)';
    const inTechnician  = seg0 === '(technician)';
    const inProtected   = inCustomer || inTechnician;

    // Guest trying to access a role-gated group → send to guest home
    if (!user && inProtected) {
      router.replace('/');
      return;
    }

    // Cross-role mismatch: logged-in user is in the wrong role's route group.
    if (user && inCustomer && user.role !== 'customer') {
      router.replace(user.role === 'technician' ? '/(technician)' : '/');
      return;
    }
    if (user && inTechnician && user.role !== 'technician') {
      router.replace(user.role === 'customer' ? '/(customer)' : '/');
      return;
    }

    // Authenticated user on the guest home or login screen → send to role home
    const onGuestRoot = !seg0 || seg0 === 'login';
    if (user && onGuestRoot) {
      if (user.role === 'customer')        router.replace('/(customer)');
      else if (user.role === 'technician') router.replace('/(technician)');
      // admin/super_admin — let them stay on index (they'd use the web dashboard)
    }
  }, [
    clearReferralCode,
    user,
    isLoading,
    referralCode,
    referralReady,
    introReady,
    segments,
  ]);

  useEffect(() => {
    if (referralRouteInFlightRef.current && pathname === '/register') {
      referralRouteInFlightRef.current = false;
    }
  }, [pathname]);

  if (isLoading || !referralReady || !introReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
      <View style={{ flex: 1, direction }}>
      <Stack screenOptions={{ headerShown: false }} />
      <PersistentTabBar />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });
  const [startupReady, setStartupReady] = useState(false);

  useEffect(() => {
    if ((fontsLoaded || fontError) && startupReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, startupReady]);

  // ── Android channel ───────────────────────────────────────────────────────
  // Create early — before any notification can arrive from the OS.
  useEffect(() => {
    createAndroidChannel().catch(() => null);
  }, []);

  // ── Global web input focus styles ─────────────────────────────────────────
  // On Expo web every TextInput renders as <input> or <textarea>. The browser
  // applies a thick black outline on :focus by default. We remove it here and
  // replace it with a subtle golden ring matching the app's brand color.
  // This single injection covers ALL current and future inputs app-wide.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.id = 'fnashha-input-focus-reset';
    style.textContent = `
      /* Remove browser default focus outline from every input */
      input:focus, textarea:focus, [contenteditable]:focus {
        outline: none !important;
      }
      /* Brand-colour focus ring via box-shadow (layout-safe: no size change) */
      input:focus, textarea:focus {
        box-shadow: 0 0 0 2px rgba(233, 183, 58, 0.45) !important;
        border-radius: 4px;
      }
      /* Also strip the tap/press highlight browsers add on mobile web */
      input, textarea {
        -webkit-tap-highlight-color: transparent;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <LocaleProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <ReferralProvider>
                    <AuthProvider>
                      <AuthGate onStartupReady={() => setStartupReady(true)} />
                    </AuthProvider>
                  </ReferralProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </LocaleProvider>
  );
}
