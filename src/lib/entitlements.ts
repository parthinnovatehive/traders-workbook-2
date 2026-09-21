import type { Feature, Plan, Subscription } from '@/types';

/**
 * Central subscription / feature-gating logic. Pure functions — never scatter
 * `if (plan === 'pro')` through the app; call these instead. The repository
 * layer is the enforcement point for the trade limit; the UI uses these to
 * decide what to show.
 */

export function resolvePlan(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
): Plan | null {
  if (!subscription) return null;
  return plans.find((p) => p.id === subscription.planId) ?? null;
}

const freePlan = (plans: readonly Plan[]): Plan | undefined => plans.find((p) => p.code === 'FREE');

/**
 * True once `currentPeriodEnd` is in the past.
 *
 * Single definition of "lapsed", so the badge on the membership page and the
 * limits actually being enforced can never disagree about it.
 */
export function hasLapsed(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription?.currentPeriodEnd) return false;
  const end = new Date(subscription.currentPeriodEnd).getTime();
  return !Number.isNaN(end) && end < now.getTime();
}

/** An active, non-expired paid or trial subscription. */
export function isSubscriptionActive(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return false;
  return !hasLapsed(subscription, now);
}

/** Whole days until the period ends. Negative once it has passed. */
export function daysUntilExpiry(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!subscription?.currentPeriodEnd) return null;
  const end = new Date(subscription.currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/** How near the end of a period counts as "renew soon". */
export const EXPIRING_SOON_DAYS = 7;

export type BillingPhase =
  | 'free'
  | 'trialing'
  | 'active'
  | 'expiring_soon'
  | 'past_due'
  | 'canceled'
  | 'expired';

/**
 * What to tell the user, as distinct from what is stored.
 *
 * Nothing ever writes `status = 'expired'`. No cron runs, and the payment
 * functions only touch the row when a payment lands — so the day after a plan
 * runs out the row still says `active`, while `isPaidActive` and the
 * `enforce_trade_limit` trigger have both already dropped the user to Free
 * limits. Rendering `subscription.status` directly is how this page showed a
 * green "Active" badge to someone who had silently lost their paid features.
 *
 * Derive the phase from the dates instead; the stored status only decides
 * between the cases the dates cannot distinguish.
 */
export function billingPhase(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  now: Date = new Date(),
): BillingPhase {
  const plan = resolvePlan(subscription, plans);
  if (!subscription || !plan || plan.code === 'FREE') return 'free';

  if (hasLapsed(subscription, now) || subscription.status === 'expired') return 'expired';
  if (subscription.status === 'canceled') return 'canceled';
  if (subscription.status === 'past_due') return 'past_due';
  if (subscription.status === 'trialing') return 'trialing';

  const days = daysUntilExpiry(subscription, now);
  if (days !== null && days <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'active';
}

/** Has an ACTIVE paid (non-free) plan. */
export function isPaidActive(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  now: Date = new Date(),
): boolean {
  const plan = resolvePlan(subscription, plans);
  return Boolean(plan && plan.code !== 'FREE' && isSubscriptionActive(subscription, now));
}

/** The plan whose limits currently apply (falls back to Free when not paid-active). */
function effectivePlan(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  now: Date = new Date(),
): Plan | null {
  if (isPaidActive(subscription, plans, now)) return resolvePlan(subscription, plans);
  return freePlan(plans) ?? resolvePlan(subscription, plans);
}

export function canAccessFeature(
  feature: Feature,
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  now: Date = new Date(),
): boolean {
  if (feature === 'trade_entry') return true; // gated by trade count, not plan
  const plan = effectivePlan(subscription, plans, now);
  return plan?.limits[feature] === true;
}

/** Max trades allowed (-1 = unlimited). */
export function tradeLimit(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  now: Date = new Date(),
): number {
  const plan = effectivePlan(subscription, plans, now);
  const lim = plan?.limits.maxTrades;
  return typeof lim === 'number' ? lim : 30;
}

export function canCreateTrade(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  tradesUsed: number,
  now: Date = new Date(),
): boolean {
  const limit = tradeLimit(subscription, plans, now);
  if (limit < 0) return true; // unlimited
  return tradesUsed < limit;
}

/** Max custom (non-system) strategies allowed (-1 = unlimited). */
export function customStrategyLimit(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  now: Date = new Date(),
): number {
  const plan = effectivePlan(subscription, plans, now);
  const lim = plan?.limits.customStrategies;
  return typeof lim === 'number' ? lim : 1;
}

export function canCreateStrategy(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  strategiesUsed: number,
  now: Date = new Date(),
): boolean {
  const limit = customStrategyLimit(subscription, plans, now);
  if (limit < 0) return true; // unlimited
  return strategiesUsed < limit;
}

export interface Entitlements {
  plan: Plan | null;
  status: Subscription['status'];
  paidActive: boolean;
  tradeLimit: number; // -1 = unlimited
  tradesUsed: number;
  tradesRemaining: number; // -1 = unlimited
  canCreateTrade: boolean;
  /** Fraction of the trade allowance consumed, 0–1. Always 0 when unlimited. */
  tradeUsageRatio: number;
  strategyLimit: number; // -1 = unlimited
}

export function getEntitlements(
  subscription: Subscription | null | undefined,
  plans: readonly Plan[],
  tradesUsed: number,
  now: Date = new Date(),
): Entitlements {
  const limit = tradeLimit(subscription, plans, now);
  return {
    plan: resolvePlan(subscription, plans),
    status: subscription?.status ?? 'free',
    paidActive: isPaidActive(subscription, plans, now),
    tradeLimit: limit,
    tradesUsed,
    tradesRemaining: limit < 0 ? -1 : Math.max(0, limit - tradesUsed),
    canCreateTrade: canCreateTrade(subscription, plans, tradesUsed, now),
    tradeUsageRatio: limit <= 0 ? 0 : Math.min(1, tradesUsed / limit),
    strategyLimit: customStrategyLimit(subscription, plans, now),
  };
}
