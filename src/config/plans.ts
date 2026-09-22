import type { Feature, Plan } from '@/types';

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
// actually checks. Copy that promises a capability no code enforces is how a
// plan page becomes a false claim.
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
    },
    isActive: true,
    sortOrder: 0,
    discountPercent: 0,
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
    discountPercent: 0,
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
    discountPercent: 0,
  },
  // Longer commitments are priced from the monthly figure above by
  // `priceFromMonthly`, so `price` and `discountPercent` always agree. Editing
  // a monthly price without recalculating these is what `isPriceStale` catches.
  {
    id: 'plan-pro-quarterly',
    code: 'PRO',
    name: 'Pro',
    price: 4317, // 1599 × 3 − 10%
    billingPeriod: 'quarterly',
    currency: 'INR',
    features: PRO_FEATURES,
    limits: { ...PRO_LIMITS },
    isActive: true,
    sortOrder: 3,
    discountPercent: 10,
  },
  {
    id: 'plan-elite-quarterly',
    code: 'ELITE',
    name: 'Elite',
    price: 8907, // 3299 × 3 − 10%
    billingPeriod: 'quarterly',
    currency: 'INR',
    features: ELITE_FEATURES,
    limits: { ...ELITE_LIMITS },
    isActive: true,
    sortOrder: 4,
    discountPercent: 10,
  },
  {
    id: 'plan-pro-yearly',
    code: 'PRO',
    name: 'Pro',
    price: 15350, // 1599 × 12 − 20%
    billingPeriod: 'yearly',
    currency: 'INR',
    features: PRO_FEATURES,
    limits: { ...PRO_LIMITS },
    isActive: true,
    sortOrder: 5,
    discountPercent: 20,
  },
  {
    id: 'plan-elite-yearly',
    code: 'ELITE',
    name: 'Elite',
    price: 31670, // 3299 × 12 − 20%
    billingPeriod: 'yearly',
    currency: 'INR',
    features: ELITE_FEATURES,
    limits: { ...ELITE_LIMITS },
    isActive: true,
    sortOrder: 6,
    discountPercent: 20,
  },
];

/** The free-tier trade limit lives in the free plan's config (admin-editable). */
export const FREE_TRADE_LIMIT =
  (DEFAULT_PLANS.find((p) => p.code === 'FREE')?.limits.maxTrades as number | undefined) ?? 30;

/* -------------------------------------------------------------------------- */
/* Admin-facing metadata                                                      */
/* -------------------------------------------------------------------------- */

export interface FeatureMeta {
  label: string;
  description: string;
  /**
   * Where the flag is actually checked, or null if nothing checks it.
   *
   * This is not documentation for its own sake. The rule in `types/plan.ts` is
   * that a flag must be enforced somewhere or stay out of the marketing copy —
   * so the admin page disables any flag with no call site rather than letting
   * someone switch on a feature that does nothing and then sell it.
   */
  enforcedIn: string | null;
}

export const FEATURE_META: Record<Feature, FeatureMeta> = {
  trade_entry: {
    label: 'Trade entry',
    description: 'Recording trades. Limited by the trade count, not by this flag.',
    enforcedIn: 'always on',
  },
  advanced_analytics: {
    label: 'Advanced analytics',
    description: 'The full Analytics page — equity curve, R-distribution, drawdown.',
    enforcedIn: 'pages/Analytics.tsx',
  },
  advanced_risk: {
    label: 'Advanced risk tools',
    description: 'Risk Management: position sizing, drawdown limits, exposure.',
    enforcedIn: 'pages/RiskManagement.tsx',
  },
  reports: {
    label: 'Reports',
    description: 'Generated performance reports.',
    enforcedIn: 'pages/Reports.tsx',
  },
  export: {
    label: 'CSV export',
    description: 'Exporting the journal from Settings.',
    enforcedIn: 'pages/Settings.tsx',
  },
  strategy_analytics: {
    label: 'Strategy analytics',
    description: 'Per-strategy performance breakdowns.',
    enforcedIn: 'pages/Strategies.tsx',
  },
  psychology_analytics: {
    label: 'Psychology analytics',
    description: 'Emotion and discipline tracking.',
    enforcedIn: 'pages/Psychology.tsx',
  },
  halls: {
    label: 'Hall of Fame & Shame',
    description: 'Best and worst trade leaderboards.',
    enforcedIn: 'pages/HallOfFame.tsx, pages/HallOfShame.tsx',
  },
};

/** Numeric allowances, edited as plain number inputs. */
export const PLAN_LIMIT_FIELDS = [
  { key: 'maxTrades', label: 'Trade entries', hint: '-1 = unlimited' },
  { key: 'customStrategies', label: 'Custom strategies', hint: '-1 = unlimited' },
] as const;
