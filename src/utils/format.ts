/** Formatting helpers. Null/undefined/non-finite render as "N/A" — never a fake 0. */
import { currencySymbol } from '@/constants/currencies';

const NA = 'N/A';

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  opts: { compact?: boolean; dp?: number; locale?: string } = {},
): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const { compact = false, dp = 2, locale } = opts;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : dp,
      minimumFractionDigits: compact ? 0 : dp,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(dp)}`;
  }
}

/** Currencies that use the Indian lakh/crore grouping rather than K/M/B. */
const INDIAN_NUMBERING = new Set(['INR']);

const CRORE = 1e7;
const LAKH = 1e5;

/**
 * A large value shortened so it cannot overflow its card, using the numbering
 * system the reader actually expects:
 *   INR         → ₹1.25 L, ₹3.4 Cr
 *   everything  → $12.5K, $1.2M, $3.4B
 *
 * Values below the first threshold are returned in full, so small numbers never
 * lose precision. Pair with a `title` attribute carrying the exact figure.
 */
export function formatCompactCurrency(
  value: number | null | undefined,
  currency = 'USD',
  opts: { dp?: number } = {},
): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const { dp = 2 } = opts;

  const symbol = currencySymbol(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const short = (scaled: number, suffix: string): string => {
    // 1 decimal is enough once a unit suffix is present; drop a trailing ".0".
    const text = scaled.toFixed(scaled >= 100 ? 0 : 1).replace(/\.0$/, '');
    return `${sign}${symbol}${text}${suffix}`;
  };

  if (INDIAN_NUMBERING.has(currency)) {
    if (abs >= CRORE) return short(abs / CRORE, ' Cr');
    if (abs >= LAKH) return short(abs / LAKH, ' L');
    // Below a lakh, use Indian digit grouping (1,23,456 rather than 123,456).
    return formatCurrency(value, currency, { dp, locale: 'en-IN' });
  }

  if (abs >= 1e9) return short(abs / 1e9, 'B');
  if (abs >= 1e6) return short(abs / 1e6, 'M');
  if (abs >= 1e3) return short(abs / 1e3, 'K');
  return formatCurrency(value, currency, { dp });
}

/** Compact currency with an explicit +/- sign (for P&L). */
export function formatCompactSignedCurrency(
  value: number | null | undefined,
  currency = 'USD',
): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCompactCurrency(value, currency)}`;
}

/** Currency with an explicit +/- sign (for P&L). */
export function formatSignedCurrency(
  value: number | null | undefined,
  currency = 'USD',
  opts: { compact?: boolean } = {},
): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrency(value, currency, opts)}`;
}

export function formatNumber(value: number | null | undefined, dp = 2): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: dp,
    minimumFractionDigits: 0,
  }).format(value);
}

/** Value is already in percent units (e.g. 66.67 => "66.67%"). */
export function formatPercent(value: number | null | undefined, dp = 2): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  return `${value.toFixed(dp)}%`;
}

export function formatSignedPercent(value: number | null | undefined, dp = 2): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(dp)}%`;
}

export function formatR(value: number | null | undefined): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}R`;
}

/** Sign of a value as a semantic direction, for coloring P&L. */
export function pnlTone(value: number | null | undefined): 'profit' | 'loss' | 'neutral' {
  if (isNil(value) || !Number.isFinite(value) || value === 0) return 'neutral';
  return value > 0 ? 'profit' : 'loss';
}
