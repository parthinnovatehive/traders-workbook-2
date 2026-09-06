/**
 * Money & numeric helpers.
 *
 * Every rounding decision in the app funnels through here, so the calculation
 * engine has a single place that controls precision. Financial code must not
 * scatter ad-hoc `toFixed` calls — float drift in a P&L ledger is unacceptable.
 */

/**
 * Round `value` to `dp` decimal places using round-half-away-from-zero
 * (so 2.675 -> 2.68 and -2.675 -> -2.68), correcting the usual binary
 * floating-point representation errors.
 */
export function roundTo(value: number, dp = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** dp;
  const scaled = value * factor * (1 + Number.EPSILON);
  const rounded = (value >= 0 ? Math.round(scaled) : -Math.round(-scaled)) / factor;
  // Normalize -0 to 0 so downstream comparisons and display are clean.
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Round to a currency's minor unit (2 dp by default). */
export function roundMoney(value: number, dp = 2): number {
  return roundTo(value, dp);
}

/** Type guard for a usable, finite number (rejects NaN, Infinity, non-numbers). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
