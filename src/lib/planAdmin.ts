import type { BillingPeriod, Feature, Plan } from '@/types';
import { PERIOD_LABEL, monthlyPlanFor, priceFromMonthly } from '@/lib/pricing';
import { FEATURE_META } from '@/config/plans';

/**
 * Validation for the admin Plans editor.
 *
 * Pure and separate from the component so the rules can be tested, and so the
 * same rules apply to both the "edit" and "create" paths rather than being
 * written twice and drifting.
 */

/** Mirrors the DB constraint added in migration 0009. */
export const PLAN_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,23}$/;

export interface PlanFormValues {
  code: string;
  name: string;
  price: string;
  currency: string;
  billingPeriod: BillingPeriod;
  discountPercent: string;
  sortOrder: string;
  features: string[];
  limits: Record<string, number | boolean>;
  isActive: boolean;
}

export interface PlanValidation {
  /** Blocks saving. */
  errors: string[];
  /** Worth saying out loud, but the admin may know better. */
  warnings: string[];
}

/** `plan-pro-monthly` — readable ids, derived the same way everywhere. */
export function derivePlanId(code: string, billingPeriod: string): string {
  return `plan-${code.toLowerCase()}-${billingPeriod}`;
}

export function validatePlanForm(
  values: PlanFormValues,
  allPlans: readonly Plan[],
  options: { isNew: boolean; originalId?: string },
): PlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const code = values.code.trim().toUpperCase();
  if (!PLAN_CODE_PATTERN.test(code)) {
    errors.push('Code must start with a letter and use 2–24 uppercase letters, digits or _.');
  }

  if (!values.name.trim()) errors.push('Display name is required.');

  const price = Number(values.price);
  if (!Number.isFinite(price) || price < 0) errors.push('Price must be zero or more.');

  if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.push('Currency must be a 3-letter code, e.g. INR.');
  }

  const sortOrder = Number(values.sortOrder);
  if (!Number.isInteger(sortOrder)) errors.push('Sort order must be a whole number.');

  for (const [key, value] of Object.entries(values.limits)) {
    if (typeof value !== 'number') continue;
    if (!Number.isInteger(value) || value < -1) {
      errors.push(`${key} must be a whole number (-1 for unlimited).`);
    }
  }

  // Creating a plan whose id already exists fails on the primary key; catch it
  // here so the admin sees it before the round trip.
  if (options.isNew) {
    const id = derivePlanId(code, values.billingPeriod);
    if (allPlans.some((p) => p.id === id)) {
      errors.push(`A ${code} ${values.billingPeriod} plan already exists. Edit that one instead.`);
    }
  }

  // FREE is load-bearing: handle_new_user() places every new signup on it.
  const original = options.originalId ? allPlans.find((p) => p.id === options.originalId) : null;
  if (original?.code === 'FREE') {
    const otherFree = allPlans.some((p) => p.code === 'FREE' && p.id !== original.id);
    if (code !== 'FREE' && !otherFree) {
      errors.push('This is the only FREE plan — new signups depend on it. Its code cannot change.');
    }
    if (!values.isActive && !otherFree) {
      warnings.push(
        'Hiding the only FREE plan removes it from the pricing page. Signups still work, but nobody can see the free tier.',
      );
    }
    if (price > 0) warnings.push('A FREE-coded plan with a price above zero will confuse the upgrade flow.');
  }

  // Discount, and whether the stored price still agrees with it.
  const discount = Number(values.discountPercent);
  if (!Number.isFinite(discount) || discount < 0 || discount >= 100) {
    errors.push('Discount must be between 0 and 99%.');
  } else if (values.billingPeriod === 'monthly') {
    if (discount > 0) {
      errors.push('Monthly is the baseline every discount is measured against — it cannot be discounted.');
    }
  } else {
    const base = monthlyPlanFor(code, allPlans);
    if (!base) {
      warnings.push(
        `No ${code} monthly plan exists, so this price has no baseline and no "save x%" can be shown.`,
      );
    } else if (base.price > 0) {
      const expected = priceFromMonthly(base.price, values.billingPeriod, discount);
      if (Math.abs(expected - price) > 1) {
        warnings.push(
          `${PERIOD_LABEL[values.billingPeriod]} at ${discount}% off ${base.price} monthly should be ${expected}, not ${price}. Use “Apply discount” to recalculate.`,
        );
      }
    }
  }

  // A flag nothing checks grants nothing. Selling it would be a false claim.
  for (const [feature, enabled] of Object.entries(values.limits)) {
    if (enabled !== true) continue;
    const meta = FEATURE_META[feature as Feature];
    if (meta && meta.enforcedIn === null) {
      warnings.push(`"${meta.label}" is not implemented yet — enabling it grants nothing.`);
    }
  }

  return { errors, warnings };
}

/** The plan-shaped payload the repository expects, from raw form strings. */
export function toPlanPatch(values: PlanFormValues): Omit<Plan, 'id' | 'code'> {
  return {
    name: values.name.trim(),
    price: Number(values.price) || 0,
    billingPeriod: values.billingPeriod,
    currency: values.currency.trim().toUpperCase(),
    features: values.features.map((f) => f.trim()).filter(Boolean),
    limits: values.limits,
    isActive: values.isActive,
    sortOrder: Number(values.sortOrder) || 0,
    discountPercent: Number(values.discountPercent) || 0,
  };
}
