import { router } from 'expo-router';
import { markIntroPlayedThisSession } from '@/constants/intro';

/**
 * Finish a local logout by making the public guest home the only reachable
 * route in the current navigation stack.
 *
 * This intentionally does not touch auth state or storage. The caller must
 * complete the existing logout/session cleanup before invoking it.
 */
export function navigateToGuestHomeAfterLogout(): void {
  // Logging out must not be treated as a cold launch that should replay intro.
  markIntroPlayedThisSession();
  router.dismissAll();
  router.replace('/');
}