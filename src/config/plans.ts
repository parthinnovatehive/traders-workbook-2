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
  halls: false,
  ai_insights: false,
} as const;

const ELITE_LIMITS = { ...PRO_LIMITS, halls: true } as const;

const PRO_FEATURES = [
  'Unlimited trades',
  'Full analytics suite',
  'Advanced risk tools',
  'Strategy & psychology analytics',
  'Reports + CSV export',
  'Unlimited custom strategies',
];

// Every line here maps to a flag in PRO_LIMITS/ELITE_LIMITS that something
// actually checks. `ai_insights` stays out of this list until the AI review
// layer exists — selling it while `grep ai_insights src/` finds no
// implementation is how a plan page becomes a false claim.
const ELITE_FEATURES = [
  'Everything in Pro',
  'Hall of Fame & Hall of Shame',
  'Priority support',
];

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan-free',
    code: 'FREE',
    name: 'Free',
    price: 0,
    billingPeriod: 'monthly',
    currency: 'INR',
    features: [
      'Up to 30 trades',
      'Journal, calendar & core metrics',
      'Dashboard',
      '1 custom strategy',
    ],
    limits: {
      maxTrades: 30,
      customStrategies: 1,
      advanced_analytics: false,
      advanced_risk: false,
      reports: false,
      export: false,
      strategy_analytics: false,
      psychology_analytics: false,
      halls: false,
      ai_insights: false,
    },
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'plan-pro-monthly',
    code: 'PRO',
    name: 'Pro',
    price: 1599,
    billingPeriod: 'monthly',
    currency: 'INR',
    features: PRO_FEATURES,
    limits: { ...PRO_LIMITS },
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'plan-elite-monthly',
    code: 'ELITE',
    name: 'Elite',
    price: 3299,
    billingPeriod: 'monthly',
    currency: 'INR',
    features: ELITE_FEATURES,
    limits: { ...ELITE_LIMITS },
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'plan-pro-yearly',
    code: 'PRO',
    name: 'Pro',
    price: 15499, // ~20% off 12× monthly
    billingPeriod: 'yearly',
    currency: 'INR',
    features: PRO_FEATURES,
    limits: { ...PRO_LIMITS },
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'plan-elite-yearly',
    code: 'ELITE',
    name: 'Elite',
    price: 31999, // ~20% off 12× monthly
    billingPeriod: 'yearly',
    currency: 'INR',
    features: ELITE_FEATURES,
    limits: { ...ELITE_LIMITS },
    isActive: true,
    sortOrder: 4,
  },
];

/** The free-tier trade limit lives in the free plan's config (admin-editable). */
export const FREE_TRADE_LIMIT =
  (DEFAULT_PLANS.find((p) => p.code === 'FREE')?.limits.maxTrades as number | undefined) ?? 30;
