/** Formatting helpers. Null/undefined/non-finite render as "N/A" — never a fake 0. */

const NA = 'N/A';

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  opts: { compact?: boolean; dp?: number } = {},
): string {
  if (isNil(value) || !Number.isFinite(value)) return NA;
  const { compact = false, dp = 2 } = opts;
  try {
    return new Intl.NumberFormat(undefined, {
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
