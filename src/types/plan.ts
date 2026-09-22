import type { ISODateTime, UUID } from './common';

export const PLAN_CODES = ['FREE', 'PRO', 'ELITE'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const BILLING_PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** A pricing plan. Admin-editable; never hardcoded across components (Section 23). */
export interface Plan {
  id: UUID;
  /**
   * Tier key. `PLAN_CODES` are the built-in ones, but admins can add tiers, so
   * this is a string rather than that union — the DB constraint (migration
   * 0009) is what keeps it to an uppercase identifier.
   *
   * 'FREE' is load-bearing: `handle_new_user` puts new signups on it and the
   * entitlement helpers fall back to it. A row with that code must always exist.
   */
  code: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  currency: string;
  features: string[];
  /** Feature flags / numeric limits, e.g. { maxTrades: 100, halls: false }. */
  limits: Record<string, number | boolean>;
  isActive: boolean;
  sortOrder: number;
  /**
   * Discount against paying monthly for the same span, as a percentage.
   *
   * Presentation and admin intent only — `price` remains the authoritative
   * amount charged, because `create_payment_order` reads it and nothing the
   * browser sends can influence it. Keeping the intent separate means editing
   * the monthly price can flag the longer periods as stale rather than silently
   * changing what people pay.
   */
  discountPercent: number;
}

/**
 * A plan being created. `id` is a text primary key chosen by the caller
 * (`plan-pro-monthly`, not a uuid), so it is derived from code + period rather
 * than generated randomly — the readable ids are worth keeping.
 */
export type PlanDraft = Omit<Plan, 'id'> & { id?: string };

export const SUBSCRIPTION_STATUSES = [
  'free',
  'active',
  'trialing',
  'past_due',
  'expired',
  'canceled',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface Subscription {
  id: UUID;
  userId: UUID;
  planId: UUID;
  status: SubscriptionStatus;
  currentPeriodStart?: ISODateTime;
  currentPeriodEnd?: ISODateTime;
}

/**
 * Gateable features (see src/lib/entitlements.ts).
 *
 * Every entry here must be enforced somewhere in the UI. A flag that is
 * declared, advertised and never checked is how Free users end up with Pro
 * features — `FEATURE_META.enforcedIn` in `config/plans.ts` records the call
 * site for each, and a test asserts none is missing.
 *
 * There is deliberately no placeholder for unbuilt work. `ai_insights` used to
 * sit here as a reserved flag and only ever caused confusion: it appeared in
 * the admin editor, granted nothing, and invited someone to sell it.
 */
export const FEATURES = [
  'trade_entry',
  'advanced_analytics',
  'advanced_risk',
  'reports',
  'export',
  'strategy_analytics',
  'psychology_analytics',
  'halls',
] as const;
export type Feature = (typeof FEATURES)[number];
