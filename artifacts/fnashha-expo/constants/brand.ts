/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          FNASHHA EXPO — CENTRAL BRAND CONFIGURATION             ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  This is the ONE source of truth for all static branding        ║
 * ║  values in the Expo app.                                        ║
 * ║                                                                  ║
 * ║  Runtime screens  → import { BRAND } from '@/constants/brand'   ║
 * ║  Build config     → app.json contains the static Expo configuration ║
 * ║  CMS fallbacks    → get(CMS_KEYS.APP_NAME, BRAND.NAME)          ║
 * ║                                                                  ║
 * ║  To rename the app: change BRAND.NAME here.                     ║
 * ║  To change the icon: replace ./assets/images/icon.png and       ║
 * ║    update BRAND.ICON_PATH below.                                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * NOTE: This file must remain free of React Native imports.
 */

export const BRAND = {
  // ─── Identity ────────────────────────────────────────────────────

  /** Primary display name shown in UI when CMS is unavailable */
  NAME: 'فنشها',

  /** Short / abbreviated name (e.g. for tab labels, notifications) */
  SHORT_NAME: 'فنشها',

  /**
   * App slug — used as the Expo project slug and as the base for
   * deep-link URL scheme.  Must be lowercase ASCII + hyphens only.
   */
  SLUG: 'fnashha-expo',

  /** iOS / Android deep-link URL scheme (e.g. fnashha-expo://...) */
  SCHEME: 'fnashha-expo',

  // ─── Visual identity ──────────────────────────────────────────────

  /**
   * Brand primary colour — golden amber.
   * Must stay in sync with constants/colors.ts → light.primary / dark.primary.
   */
  PRIMARY: '#E9B73A',

  /**
   * App background / splash screen background colour.
   * Must stay in sync with constants/colors.ts → light.background.
   */
  SPLASH_BG: '#F7F9FB',

   // ─── Asset paths (relative to the Expo project root) ─────────────

  /**
   * App icon used for Android icon, iOS icon, splash image, and web
   * favicon.  Path is relative to the project root.
   *
   * This file is the "square, store-ready" version of the brand logo.
   * The runtime in-app logo (AppLogo component) uses logo.png,
   * generated from the same high-resolution source.
   */
  ICON_PATH: './assets/images/icon.png',

  // ─── AsyncStorage keys ────────────────────────────────────────────

  /**
   * Keep these keys stable across app updates so existing user
   * devices retain their saved preferences after an OTA update.
   * Changing a key is equivalent to wiping that preference for all
   * existing users.
   */
  STORAGE_KEYS: {
    /** User's dark / light theme preference */
    THEME: 'fnashha_theme_mode',
    /** Tracks whether the intro slideshow has played this session */
    INTRO_SEEN: 'fnashha_intro_seen_v2',
  },
} as const;
