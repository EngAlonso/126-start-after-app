/**
 * Hook for accessing CMS settings from the backend.
 * Settings are cached for 5 minutes; stale-while-revalidate on focus.
 *
 * Usage — always supply BRAND.NAME as the fallback so the single source
 * of truth for the default app name stays in constants/brand.ts:
 *
 *   import { BRAND } from '@/constants/brand';
 *   const { get } = useCmsSettings();
 *   const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);
 *   const logoUrl = get(CMS_KEYS.LOGO_URL);
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/hooks/useApi';
import type { CmsSetting } from '@/types';

type SettingsMap = Record<string, string>;

async function fetchSettings(): Promise<SettingsMap> {
  const raw = await apiFetch<CmsSetting[] | SettingsMap>('/api/cms/settings');
  // Handle both array and object responses
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.map(s => [s.key, s.value ?? '']));
  }
  return raw as SettingsMap;
}

export function useCmsSettings() {
  const { data, isLoading } = useQuery<SettingsMap>({
    queryKey: ['cms-settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const settings = data ?? {};

  const get = (key: string, fallback = ''): string =>
    settings[key] ?? fallback;

  const getNumber = (key: string, fallback = 0): number => {
    const val = settings[key];
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const getBool = (key: string, fallback = false): boolean => {
    const val = settings[key];
    if (val === undefined) return fallback;
    return val === 'true' || val === '1';
  };

  return { settings, get, getNumber, getBool, isLoading };
}

/**
 * CMS setting keys used across the app.
 *
 * All fallback values in screens must reference BRAND.* from
 * constants/brand.ts — that file is the single source of truth for
 * static branding:
 *
 *   get(CMS_KEYS.APP_NAME, BRAND.NAME)   ← NOT get(CMS_KEYS.APP_NAME, 'فنشها')
 */
export const CMS_KEYS = {
  APP_NAME:         'siteName',        // brand / app / site display name
  SHORT_NAME:       'siteShortName',   // abbreviated name (tab labels, push notifications)
  LOGO_URL:         'logoUrl',         // remote logo image URL
  SPLASH_LOGO:      'splashLogo',      // optional override for the in-app splash logo
  WEBSITE_URL:      'siteUrl',         // canonical public URL of the platform
  PHONE:            'contactPhone',
  WHATSAPP:         'whatsapp',
  EMAIL:            'contactEmail',
  REFERRAL_COINS:   'referralRewardCoins',
  COIN_EARN_RATIO:  'coinEarnRatio',
  COIN_CONVERSION:  'coinConversionRatio',
  LOYALTY_ENABLED:  'loyaltyEnabled',
  OFFER_EXPIRY_HOURS: 'offerExpiryHours',
  MIN_OFFER_PRICE:  'minOfferPrice',
} as const;
