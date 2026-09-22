import type { BillingPeriod, Plan } from '@/types';

/**
 * Billing-period arithmetic and the monthly-price-plus-discount model.
 *
 * The rule: an admin sets one monthly price per tier, then a discount for the
 * longer commitments. `price` on each plan row stays the authoritative amount
 * charged — `create_payment_order` reads it and the browser cannot influence it
 * — so these helpers COMPUTE a price for the admin to store, rather than
 * deriving it at render time. A price that is calculated on the way to the
 * gateway is a price that can disagree with the one the customer was shown.
 *
 * Pure: no I/O, no Date.now().
 */

export const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

/** Short suffix for a price, e.g. "₹1,599 / mo". */
export const PERIOD_SUFFIX: Record<BillingPeriod, string> = {
  monthly: 'mo',
  quarterly: 'qtr',
  yearly: 'yr',
};

/** "billed quarterly" — how the commitment reads next to a per-month figure. */
export const PERIOD_ADVERB: Record<BillingPeriod, string> = {
  monthly: 'billed monthly',
  quarterly: 'billed quarterly',
  yearly: 'billed yearly',
};

export function periodMonths(period: BillingPeriod): number {
  return PERIOD_MONTHS[period] ?? 1;
}

/** Undiscounted cost of the same span paid month by month. */
export function fullPriceForPeriod(monthlyPrice: number, period: BillingPeriod): number {
  return monthlyPrice * periodMonths(period);
}

/**
 * What to charge for `period`, given the tier's monthly price and a discount.
 *
 * Rounded to a whole currency unit: nobody prices a plan at ₹4,316.40, and a
 * fractional amount survives all the way to the gateway as paise.
 */
export function priceFromMonthly(
  monthlyPrice: number,
  period: BillingPeriod,
  discountPercent: number,
): number {
  const full = fullPriceForPeriod(monthlyPrice, period);
  const pct = Number.isFinite(discountPercent) ? Math.min(100, Math.max(0, discountPercent)) : 0;
  return Math.max(0, Math.round(full * (1 - pct / 100)));
}

/** The discount an existing price actually represents. Null when there is no baseline. */
export function impliedDiscountPercent(
  monthlyPrice: number,
  price: number,
  period: BillingPeriod,
): number | null {
  const full = fullPriceForPeriod(monthlyPrice, period);
  if (full <= 0) return null;
  return Math.round(((full - price) / full) * 100);
}

/** Per-month equivalent, for "₹1,333/mo billed yearly". */
export function monthlyEquivalent(price: number, period: BillingPeriod): number {
  return price / periodMonths(period);
}

/** Absolute money saved versus paying monthly across the same span. */
export function savingsVsMonthly(
  monthlyPrice: number,
  price: number,
  period: BillingPeriod,
): number {
  return Math.max(0, fullPriceForPeriod(monthlyPrice, period) - price);
}

/** The monthly plan for a tier — the baseline every discount is measured against. */
export function monthlyPlanFor(code: string, plans: readonly Plan[]): Plan | null {
  return plans.find((p) => p.code === code && p.billingPeriod === 'monthly') ?? null;
}

/**
 * True when a plan's stored price no longer matches its own stated discount.
 *
 * Happens when the monthly price is edited and the longer periods are not
 * recalculated. Silent drift here means the pricing page advertises "save 20%"
 * next to a number that is not 20% off anything.
 */
export function isPriceStale(plan: Plan, plans: readonly Plan[], tolerance = 1): boolean {
  if (plan.billingPeriod === 'monthly') return false;
  const base = monthlyPlanFor(plan.code, plans);
  if (!base || base.price <= 0) return false;
  const expected = priceFromMonthly(base.price, plan.billingPeriod, plan.discountPercent);
  return Math.abs(expected - plan.price) > tolerance;
}
