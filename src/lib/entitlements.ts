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

/** An active, non-expired paid or trial subscription. */
export function isSubscriptionActive(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return false;
  if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) return false;
  return true;
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

export interface Entitlements {
  plan: Plan | null;
  status: Subscription['status'];
  paidActive: boolean;
  tradeLimit: number; // -1 = unlimited
  tradesUsed: number;
  tradesRemaining: number; // -1 = unlimited
  canCreateTrade: boolean;
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
  };
}
