import { describe, expect, it } from 'vitest';
import type { Plan } from '@/types';
import { derivePlanId, toPlanPatch, validatePlanForm, type PlanFormValues } from '../planAdmin';

const plan = (over: Partial<Plan>): Plan => ({
  id: 'plan-pro-monthly',
  code: 'PRO',
  name: 'Pro',
  price: 1599,
  billingPeriod: 'monthly',
  currency: 'INR',
  features: [],
  limits: { maxTrades: -1 },
  isActive: true,
  sortOrder: 2,
  discountPercent: 0,
  ...over,
});

const form = (over: Partial<PlanFormValues> = {}): PlanFormValues => ({
  code: 'PRO',
  name: 'Pro',
  price: '1599',
  currency: 'INR',
  billingPeriod: 'monthly',
  sortOrder: '2',
  discountPercent: '0',
  features: ['Unlimited trades'],
  limits: { maxTrades: -1, customStrategies: -1 },
  isActive: true,
  ...over,
});

const freePlan = plan({ id: 'plan-free', code: 'FREE', name: 'Free', price: 0, sortOrder: 1 });
const all = [freePlan, plan({})];

describe('validatePlanForm', () => {
  it('accepts a well-formed plan', () => {
    const { errors } = validatePlanForm(form(), all, { isNew: false, originalId: 'plan-pro-monthly' });
    expect(errors).toEqual([]);
  });

  it('rejects codes the database constraint would reject', () => {
    for (const code of ['1PRO', 'P', 'WITH-DASH', 'TOO_LONG_A_CODE_FOR_THE_COLUMN_LIMIT', '']) {
      const { errors } = validatePlanForm(form({ code }), all, { isNew: true });
      expect(errors.join(' ')).toMatch(/Code must/);
    }
  });

  it('normalises a lowercase code rather than rejecting it', () => {
    const { errors } = validatePlanForm(form({ code: 'starter' }), all, { isNew: true });
    expect(errors).toEqual([]);
  });

  it('rejects a negative price and a non-numeric one', () => {
    expect(validatePlanForm(form({ price: '-1' }), all, { isNew: true }).errors.join(' ')).toMatch(
      /Price/,
    );
    expect(validatePlanForm(form({ price: 'abc' }), all, { isNew: true }).errors.join(' ')).toMatch(
      /Price/,
    );
  });

  it('rejects a limit that is not a whole number or below -1', () => {
    const bad = form({ limits: { maxTrades: 1.5, customStrategies: -5 } });
    const { errors } = validatePlanForm(bad, all, { isNew: true, originalId: 'plan-x' });
    expect(errors.some((e) => e.includes('maxTrades'))).toBe(true);
    expect(errors.some((e) => e.includes('customStrategies'))).toBe(true);
  });

  it('blocks creating a duplicate code + period', () => {
    const { errors } = validatePlanForm(form({ code: 'PRO', billingPeriod: 'monthly' }), all, {
      isNew: true,
    });
    expect(errors.join(' ')).toMatch(/already exists/);
  });

  it('allows the same code in a different period', () => {
    const { errors } = validatePlanForm(form({ code: 'PRO', billingPeriod: 'yearly' }), all, {
      isNew: true,
    });
    expect(errors).toEqual([]);
  });

  /**
   * handle_new_user() puts every signup on the FREE plan. Renaming the only one
   * breaks registration for everybody, so it is an error rather than a warning.
   */
  it('refuses to rename the code of the only FREE plan', () => {
    const { errors } = validatePlanForm(form({ code: 'BASIC', price: '0' }), all, {
      isNew: false,
      originalId: 'plan-free',
    });
    expect(errors.join(' ')).toMatch(/only FREE plan/);
  });

  it('permits renaming a FREE plan when another FREE plan remains', () => {
    const withTwo = [...all, plan({ id: 'plan-free-2', code: 'FREE', name: 'Free 2' })];
    const { errors } = validatePlanForm(form({ code: 'BASIC', price: '0' }), withTwo, {
      isNew: false,
      originalId: 'plan-free',
    });
    expect(errors).toEqual([]);
  });

  it('warns, but does not block, when the only FREE plan is hidden', () => {
    const { errors, warnings } = validatePlanForm(form({ code: 'FREE', price: '0', isActive: false }), all, {
      isNew: false,
      originalId: 'plan-free',
    });
    expect(errors).toEqual([]);
    expect(warnings.join(' ')).toMatch(/pricing page/);
  });

  it('does not warn for a feature that is actually enforced', () => {
    const { warnings } = validatePlanForm(
      form({ limits: { maxTrades: -1, halls: true } }),
      all,
      { isNew: false, originalId: 'plan-pro-monthly' },
    );
    expect(warnings).toEqual([]);
  });
});

describe('derivePlanId', () => {
  it('builds the readable id used as the text primary key', () => {
    expect(derivePlanId('STARTER', 'monthly')).toBe('plan-starter-monthly');
    expect(derivePlanId('PRO', 'yearly')).toBe('plan-pro-yearly');
  });
});

describe('toPlanPatch', () => {
  it('trims copy, drops blank bullets and normalises the currency', () => {
    const patch = toPlanPatch(
      form({ features: ['  Unlimited trades  ', '', '   ', 'Reports'], currency: 'inr' }),
    );
    expect(patch.features).toEqual(['Unlimited trades', 'Reports']);
    expect(patch.currency).toBe('INR');
  });

  it('coerces numeric strings', () => {
    const patch = toPlanPatch(form({ price: '2499', sortOrder: '7' }));
    expect(patch.price).toBe(2499);
    expect(patch.sortOrder).toBe(7);
  });
});
