import ar from './ar';
import en from './en';

export type Locale = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

export const DEFAULT_LOCALE: Locale = 'ar';

export const translations = { ar, en } as const;

export function getDirection(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function isRTLLocale(locale: Locale): boolean {
  return locale === 'ar';
}

export { ar, en };
