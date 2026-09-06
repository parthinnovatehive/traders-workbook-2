import type { Plan } from '@/types';

/**
 * Centralized pricing + entitlements config — the single source of truth for
 * plans. Marketing, Membership settings and Admin all read from here (seeded so
 * admins can edit at runtime). Never hardcode a price or feature list in a
 * component. `limits` drive feature gating (see `src/lib/entitlements.ts`);
 * `maxTrades: -1` means unlimited.
 */

const PRO_LIMITS = {
  maxTrades: -1,
  customStrategies: -1,
  advanced_analytics: true,
  advanced_risk: true,
  reports: true,
  export: true,
  strategy_analytics: true,
  psychology_analytics: true,
  ai_insights: false,
} as const;

const ELITE_LIMITS = { ...PRO_LIMITS, ai_insights: true } as const;

const PRO_FEATURES = [
  'Unlimited trades',
  'Full analytics suite',
  'Advanced risk tools',
  'Strategy & psychology analytics',
  'Reports + CSV export',
  'Unlimited custom strategies',
];

const ELITE_FEATURES = [
  'Everything in Pro',
  'Hall of Fame & Hall of Shame',
  'Performance intelligence engine',
  'Early access to AI reviews',
  'Priority support',
];

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan-free',
    code: 'FREE',
    name: 'Free',
    price: 0,
    billingPeriod: 'monthly',
    currency: 'USD',
    features: ['Up to 30 trades', 'Journal & core metrics', 'Dashboard', '1 custom strategy'],
    limits: {
      maxTrades: 30,
      customStrategies: 1,
      advanced_analytics: false,
      advanced_risk: false,
      reports: false,
      export: false,
      strategy_analytics: false,
      psychology_analytics: false,
      ai_insights: false,
    },
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'plan-pro-monthly',
    code: 'PRO',
    name: 'Pro',
    price: 19,
    billingPeriod: 'monthly',
    currency: 'USD',
    features: PRO_FEATURES,
    limits: { ...PRO_LIMITS },
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'plan-elite-monthly',
    code: 'ELITE',
    name: 'Elite',
    price: 39,
    billingPeriod: 'monthly',
    currency: 'USD',
    features: ELITE_FEATURES,
    limits: { ...ELITE_LIMITS },
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'plan-pro-yearly',
    code: 'PRO',
    name: 'Pro',
    price: 182, // ~20% off 12× monthly
    billingPeriod: 'yearly',
    currency: 'USD',
    features: PRO_FEATURES,
    limits: { ...PRO_LIMITS },
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'plan-elite-yearly',
    code: 'ELITE',
    name: 'Elite',
    price: 374, // ~20% off 12× monthly
    billingPeriod: 'yearly',
    currency: 'USD',
    features: ELITE_FEATURES,
    limits: { ...ELITE_LIMITS },
    isActive: true,
    sortOrder: 4,
  },
];

/** The free-tier trade limit lives in the free plan's config (admin-editable). */
export const FREE_TRADE_LIMIT =
  (DEFAULT_PLANS.find((p) => p.code === 'FREE')?.limits.maxTrades as number | undefined) ?? 30;
