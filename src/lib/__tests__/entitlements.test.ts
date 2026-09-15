import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/types';
import { DEFAULT_PLANS } from '@/config/plans';
import {
  canAccessFeature,
  canCreateStrategy,
  canCreateTrade,
  customStrategyLimit,
  getEntitlements,
  isPaidActive,
  tradeLimit,
} from '../entitlements';

const plans = DEFAULT_PLANS;
const future = new Date(Date.now() + 864e5).toISOString();
const past = new Date(Date.now() - 864e5).toISOString();

const free: Subscription = { id: 's', userId: 'u', planId: 'plan-free', status: 'free' };
const proActive: Subscription = { id: 's', userId: 'u', planId: 'plan-pro-monthly', status: 'active', currentPeriodEnd: future };
const proExpired: Subscription = { id: 's', userId: 'u', planId: 'plan-pro-monthly', status: 'expired' };
const proLapsed: Subscription = { id: 's', userId: 'u', planId: 'plan-pro-monthly', status: 'active', currentPeriodEnd: past };
const eliteActive: Subscription = { id: 's', userId: 'u', planId: 'plan-elite-monthly', status: 'active', currentPeriodEnd: future };

describe('free trade limit (30)', () => {
  it('a new free user gets a limit of 30', () => {
    expect(tradeLimit(free, plans)).toBe(30);
  });
  it('trade #30 is allowed, #31 is blocked', () => {
    expect(canCreateTrade(free, plans, 29)).toBe(true); // creating the 30th
    expect(canCreateTrade(free, plans, 30)).toBe(false); // creating the 31st
  });
  it('a brand-new user (0 used) can create', () => {
    expect(canCreateTrade(free, plans, 0)).toBe(true);
  });
});

describe('active paid subscription', () => {
  it('is unlimited and keeps trading', () => {
    expect(isPaidActive(proActive, plans)).toBe(true);
    expect(tradeLimit(proActive, plans)).toBe(-1);
    expect(canCreateTrade(proActive, plans, 5000)).toBe(true);
  });
});

describe('expired / lapsed membership falls back to free', () => {
  it('expired status is not paid-active', () => {
    expect(isPaidActive(proExpired, plans)).toBe(false);
    expect(tradeLimit(proExpired, plans)).toBe(30);
    expect(canCreateTrade(proExpired, plans, 30)).toBe(false);
    expect(canCreateTrade(proExpired, plans, 5)).toBe(true); // existing trades still accessible; can add up to 30
  });
  it('a past period end is treated as lapsed', () => {
    expect(isPaidActive(proLapsed, plans)).toBe(false);
    expect(tradeLimit(proLapsed, plans)).toBe(30);
  });
});

describe('feature gating', () => {
  it('free plan cannot access advanced features but can enter trades', () => {
    expect(canAccessFeature('advanced_analytics', free, plans)).toBe(false);
    expect(canAccessFeature('reports', free, plans)).toBe(false);
    expect(canAccessFeature('trade_entry', free, plans)).toBe(true);
  });
  it('active pro unlocks advanced analytics & reports', () => {
    expect(canAccessFeature('advanced_analytics', proActive, plans)).toBe(true);
    expect(canAccessFeature('reports', proActive, plans)).toBe(true);
  });
  it('expired pro loses advanced access', () => {
    expect(canAccessFeature('advanced_analytics', proExpired, plans)).toBe(false);
  });

  // These four were declared on every plan and checked nowhere, so Free users
  // had the paid Risk, Strategy, export and Hall pages.
  it('free plan cannot reach risk tools, strategy analytics or export', () => {
    expect(canAccessFeature('advanced_risk', free, plans)).toBe(false);
    expect(canAccessFeature('strategy_analytics', free, plans)).toBe(false);
    expect(canAccessFeature('export', free, plans)).toBe(false);
  });

  it('active pro unlocks risk tools, strategy analytics and export', () => {
    expect(canAccessFeature('advanced_risk', proActive, plans)).toBe(true);
    expect(canAccessFeature('strategy_analytics', proActive, plans)).toBe(true);
    expect(canAccessFeature('export', proActive, plans)).toBe(true);
  });

  it('reserves the Halls for Elite, as the plan copy says', () => {
    expect(canAccessFeature('halls', free, plans)).toBe(false);
    expect(canAccessFeature('halls', proActive, plans)).toBe(false);
    expect(canAccessFeature('halls', eliteActive, plans)).toBe(true);
  });

  it('grants ai_insights to nobody — the feature does not exist yet', () => {
    for (const sub of [free, proActive, eliteActive]) {
      expect(canAccessFeature('ai_insights', sub, plans)).toBe(false);
    }
  });

  it('advertises nothing that is not enforced', () => {
    // Every plan's marketing bullet list must correspond to capability that is
    // actually switched on somewhere in `limits`.
    const elite = plans.find((p) => p.id === 'plan-elite-monthly')!;
    expect(elite.features.some((f) => /\bAI\b/i.test(f))).toBe(false);
    expect(elite.limits.halls).toBe(true);
  });
});

describe('custom strategy allowance', () => {
  it('gives a free user exactly one', () => {
    expect(customStrategyLimit(free, plans)).toBe(1);
    expect(canCreateStrategy(free, plans, 0)).toBe(true);
    expect(canCreateStrategy(free, plans, 1)).toBe(false);
  });

  it('is unlimited on an active paid plan', () => {
    expect(customStrategyLimit(proActive, plans)).toBe(-1);
    expect(canCreateStrategy(proActive, plans, 500)).toBe(true);
  });

  it('falls back to the free allowance once a plan lapses', () => {
    expect(customStrategyLimit(proExpired, plans)).toBe(1);
    expect(canCreateStrategy(proExpired, plans, 1)).toBe(false);
  });
});

describe('getEntitlements summary', () => {
  it('free user at the cap', () => {
    const e = getEntitlements(free, plans, 30);
    expect(e.plan?.code).toBe('FREE');
    expect(e.tradeLimit).toBe(30);
    expect(e.tradesRemaining).toBe(0);
    expect(e.canCreateTrade).toBe(false);
    expect(e.paidActive).toBe(false);
  });
  it('paid user is unlimited', () => {
    const e = getEntitlements(proActive, plans, 500);
    expect(e.tradeLimit).toBe(-1);
    expect(e.tradesRemaining).toBe(-1);
    expect(e.canCreateTrade).toBe(true);
    expect(e.paidActive).toBe(true);
  });
});
