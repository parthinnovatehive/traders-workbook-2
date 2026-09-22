import { describe, expect, it } from 'vitest';
import type { Plan } from '@/types';
import { FEATURES } from '@/types';
import { DEFAULT_PLANS, FEATURE_META } from '@/config/plans';
import {
  PERIOD_MONTHS,
  fullPriceForPeriod,
  impliedDiscountPercent,
  isPriceStale,
  monthlyEquivalent,
  monthlyPlanFor,
  periodMonths,
  priceFromMonthly,
  savingsVsMonthly,
} from '../pricing';

const plan = (over: Partial<Plan>): Plan => ({
  id: 'plan-pro-monthly',
  code: 'PRO',
  name: 'Pro',
  price: 1599,
  billingPeriod: 'monthly',
  currency: 'INR',
  features: [],
  limits: {},
  isActive: true,
  sortOrder: 1,
  discountPercent: 0,
  ...over,
});

describe('period arithmetic', () => {
  it('maps each period to its span in months', () => {
    expect(PERIOD_MONTHS).toEqual({ monthly: 1, quarterly: 3, yearly: 12 });
  });

  it('prices the undiscounted span from the monthly figure', () => {
    expect(fullPriceForPeriod(1599, 'quarterly')).toBe(4797);
    expect(fullPriceForPeriod(1599, 'yearly')).toBe(19188);
  });
});

describe('priceFromMonthly', () => {
  it('applies the discount and rounds to a whole unit', () => {
    expect(priceFromMonthly(1599, 'quarterly', 10)).toBe(4317); // 4797 − 10%
    expect(priceFromMonthly(1599, 'yearly', 20)).toBe(15350); // 19188 − 20%
  });

  it('is the plain multiple at 0%', () => {
    expect(priceFromMonthly(1599, 'yearly', 0)).toBe(19188);
    expect(priceFromMonthly(1599, 'monthly', 0)).toBe(1599);
  });

  it('never returns a fraction — paise would reach the gateway', () => {
    for (const pct of [7, 13, 33, 66]) {
      const p = priceFromMonthly(1599, 'yearly', pct);
      expect(Number.isInteger(p)).toBe(true);
    }
  });

  it('clamps a nonsensical discount instead of inverting the price', () => {
    expect(priceFromMonthly(1599, 'yearly', -50)).toBe(19188);
    expect(priceFromMonthly(1599, 'yearly', 150)).toBe(0);
    expect(priceFromMonthly(1599, 'yearly', Number.NaN)).toBe(19188);
  });
});

describe('impliedDiscountPercent', () => {
  it('recovers the discount a price represents', () => {
    expect(impliedDiscountPercent(1599, 15350, 'yearly')).toBe(20);
    expect(impliedDiscountPercent(1599, 4317, 'quarterly')).toBe(10);
  });

  it('round-trips with priceFromMonthly', () => {
    for (const pct of [5, 10, 15, 20, 25, 40]) {
      const price = priceFromMonthly(2499, 'yearly', pct);
      expect(impliedDiscountPercent(2499, price, 'yearly')).toBe(pct);
    }
  });

  it('is null when there is no baseline to compare against', () => {
    expect(impliedDiscountPercent(0, 5000, 'yearly')).toBeNull();
  });
});

describe('customer-facing figures', () => {
  it('shows the per-month equivalent of a committed period', () => {
    expect(monthlyEquivalent(15350, 'yearly')).toBeCloseTo(1279.17, 1);
    expect(monthlyEquivalent(4317, 'quarterly')).toBe(1439);
  });

  it('reports the money saved against paying monthly', () => {
    expect(savingsVsMonthly(1599, 15350, 'yearly')).toBe(3838);
    expect(savingsVsMonthly(1599, 4317, 'quarterly')).toBe(480);
  });

  it('never reports a negative saving for a plan priced above monthly', () => {
    expect(savingsVsMonthly(1599, 25000, 'yearly')).toBe(0);
  });
});

describe('isPriceStale', () => {
  const monthly = plan({ id: 'plan-pro-monthly', price: 1599 });

  it('is false when the price matches the stated discount', () => {
    const yearly = plan({ id: 'plan-pro-yearly', billingPeriod: 'yearly', price: 15350, discountPercent: 20 });
    expect(isPriceStale(yearly, [monthly, yearly])).toBe(false);
  });

  /** The drift this exists to catch: monthly price edited, yearly left behind. */
  it('is true once the monthly price moves and the longer period is not recalculated', () => {
    const yearly = plan({ id: 'plan-pro-yearly', billingPeriod: 'yearly', price: 15350, discountPercent: 20 });
    const raised = plan({ id: 'plan-pro-monthly', price: 1999 });
    expect(isPriceStale(yearly, [raised, yearly])).toBe(true);
  });

  it('never flags a monthly plan — it is the baseline', () => {
    expect(isPriceStale(monthly, [monthly])).toBe(false);
  });

  it('does not flag a tier with no monthly plan to compare against', () => {
    const orphan = plan({ id: 'plan-solo-yearly', code: 'SOLO', billingPeriod: 'yearly', price: 9999, discountPercent: 20 });
    expect(isPriceStale(orphan, [orphan])).toBe(false);
  });
});

describe('monthlyPlanFor', () => {
  it('finds the baseline for a tier and ignores other tiers', () => {
    const pro = plan({ id: 'plan-pro-monthly' });
    const elite = plan({ id: 'plan-elite-monthly', code: 'ELITE', price: 3299 });
    expect(monthlyPlanFor('ELITE', [pro, elite])?.id).toBe('plan-elite-monthly');
    expect(monthlyPlanFor('NOPE', [pro, elite])).toBeNull();
  });
});

describe('shipped defaults', () => {
  it('every default plan price agrees with its own stated discount', () => {
    for (const p of DEFAULT_PLANS) {
      expect(
        { id: p.id, stale: isPriceStale(p, DEFAULT_PLANS) },
      ).toEqual({ id: p.id, stale: false });
    }
  });

  it('offers every billing period', () => {
    const periods = new Set(DEFAULT_PLANS.map((p) => p.billingPeriod));
    expect([...periods].sort()).toEqual(['monthly', 'quarterly', 'yearly']);
  });

  it('no plan still carries the removed ai_insights flag', () => {
    for (const p of DEFAULT_PLANS) {
      expect(Object.keys(p.limits)).not.toContain('ai_insights');
    }
  });
});

/**
 * The rule from `types/plan.ts`: a flag must be enforced somewhere. Adding a
 * feature to FEATURES without wiring it up fails here, which is the point —
 * an unenforced flag is one an admin can tick and then sell.
 */
describe('feature flags', () => {
  it('every feature has a recorded enforcement point', () => {
    const unenforced = FEATURES.filter((f) => FEATURE_META[f]?.enforcedIn === null);
    expect(unenforced).toEqual([]);
  });

  it('FEATURE_META covers exactly the declared features', () => {
    expect(Object.keys(FEATURE_META).sort()).toEqual([...FEATURES].sort());
  });

  it('periodMonths falls back to one month for anything unrecognised', () => {
    // Mirrors the SQL fallback in migration 0010: under-grant, never over-grant.
    expect(periodMonths('weekly' as never)).toBe(1);
  });
});
