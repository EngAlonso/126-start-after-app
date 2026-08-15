import { useDirection as useDirectionFromContext } from '@/contexts/LocaleContext';
import type { Direction } from '@/lib/i18n';

/**
 * Returns the current layout direction and RTL flag derived from the active locale.
 *
 * Example:
 *   const { direction, isRTL } = useDirection();
 */
export function useDirection(): { direction: Direction; isRTL: boolean } {
  return useDirectionFromContext();
}
