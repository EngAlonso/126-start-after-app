/**
 * Shared constants and session state for the intro slideshow.
 *
 * introPlayedThisSession is a plain module-level boolean.
 *   • Starts as false on every cold app launch (JS engine initialises the module fresh).
 *   • Set to true once the intro has finished or been skipped.
 *   • Survives in-session navigation (router.replace / router.push) so index.tsx
 *     does not trigger the intro again during the same session.
 *   • Automatically resets when the app process is terminated — no AsyncStorage needed.
 */
import { BRAND } from './brand';

/**
 * AsyncStorage key for "intro already seen" persistence.
 * Sourced from BRAND.STORAGE_KEYS so the key stays in sync with
 * constants/brand.ts — the single source of truth.
 *
 * ⚠ Keep the underlying string stable across app updates.
 *   Changing it clears the seen-state for all existing users,
 *   causing the intro to replay on their next launch.
 */
export const INTRO_SEEN_KEY = BRAND.STORAGE_KEYS.INTRO_SEEN;

let introPlayedThisSession = false;

export function markIntroPlayedThisSession(): void {
  introPlayedThisSession = true;
}

export function hasIntroPlayedThisSession(): boolean {
  return introPlayedThisSession;
}
