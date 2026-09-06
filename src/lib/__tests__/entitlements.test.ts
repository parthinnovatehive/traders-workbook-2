import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/types';
import { DEFAULT_PLANS } from '@/config/plans';
import {
  canAccessFeature,
  canCreateTrade,
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
