/**
 * Global formatters — always output English (Latin) digits.
 *
 * Rules:
 *  - Numbers  : en-US locale  → 1,250  (commas, English digits)
 *  - Dates    : en-GB locale  → 15 Mar 2024  (day-first, English digits)
 *  - Times    : en-GB locale  → 14:30  (English digits)
 *
 * Never use 'ar', 'ar-EG', or any Arabic locale — they produce Arabic-Indic
 * digits (٠١٢٣...) which must not appear anywhere in the app.
 */

/**
 * Format a number with English digits and thousand separators.
 * fmtNumber(1250)  → "1,250"
 * fmtNumber(0)     → "0"
 */
export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format a date with English digits.
 * fmtDate('2024-03-15', { dateStyle: 'medium' }) → "15 Mar 2024"
 * fmtDate('2024-03-15')                          → "15/03/2024"
 */
export function fmtDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', options);
}

/**
 * Format a time with English digits.
 * fmtTime('2024-03-15T14:30:00', { hour: '2-digit', minute: '2-digit' }) → "14:30"
 */
export function fmtTime(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', options);
}
