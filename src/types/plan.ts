import type { ISODateTime, UUID } from './common';

export const PLAN_CODES = ['FREE', 'PRO', 'ELITE'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type BillingPeriod = 'monthly' | 'yearly';

/** A pricing plan. Admin-editable; never hardcoded across components (Section 23). */
export interface Plan {
  id: UUID;
  code: PlanCode;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  currency: string;
  features: string[];
  /** Feature flags / numeric limits, e.g. { maxTrades: 100, aiReviews: false }. */
  limits: Record<string, number | boolean>;
  isActive: boolean;
  sortOrder: number;
}

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

/** Gateable features (see src/lib/entitlements.ts). */
export const FEATURES = [
  'trade_entry',
  'advanced_analytics',
  'advanced_risk',
  'reports',
  'export',
  'strategy_analytics',
  'psychology_analytics',
  'ai_insights',
] as const;
export type Feature = (typeof FEATURES)[number];
