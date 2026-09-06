/**
 * Journal taxonomy — the fixed vocabularies used when tagging trades.
 * These are leaf constants (no imports from the app) so both types and UI can
 * derive from them without circular dependencies.
 */

/* -------------------------------------------------------------------------- */
/* Markets                                                                     */
/* -------------------------------------------------------------------------- */

export const MARKETS = [
  'Equity',
  'Futures',
  'Options',
  'Forex',
  'Crypto',
  'Commodities',
  'Index',
  'Other',
] as const;
export type Market = (typeof MARKETS)[number];

/* -------------------------------------------------------------------------- */
/* Mistakes (execution errors)                                                 */
/* -------------------------------------------------------------------------- */

export const MISTAKE_CODES = [
  'FOMO',
  'Revenge',
  'Overtrading',
  'EarlyEntry',
  'LateEntry',
  'NoConfirmation',
  'MovedSL',
  'MovedTarget',
  'Oversizing',
  'RuleViolation',
  'Other',
] as const;
export type MistakeCode = (typeof MISTAKE_CODES)[number];

export const MISTAKE_LABELS: Record<MistakeCode, string> = {
  FOMO: 'FOMO',
  Revenge: 'Revenge trade',
  Overtrading: 'Overtrading',
  EarlyEntry: 'Early entry',
  LateEntry: 'Late entry',
  NoConfirmation: 'No confirmation',
  MovedSL: 'Moved stop loss',
  MovedTarget: 'Moved target',
  Oversizing: 'Oversizing',
  RuleViolation: 'Rule violation',
  Other: 'Other',
};

/* -------------------------------------------------------------------------- */
/* Psychology tags (emotional / behavioural state)                             */
/* -------------------------------------------------------------------------- */

export const PSYCH_CODES = [
  'FOMO',
  'Fear',
  'Greed',
  'Revenge',
  'Confidence',
  'Patience',
  'Discipline',
] as const;
export type PsychCode = (typeof PSYCH_CODES)[number];

export const PSYCH_LABELS: Record<PsychCode, string> = {
  FOMO: 'FOMO',
  Fear: 'Fear',
  Greed: 'Greed',
  Revenge: 'Revenge',
  Confidence: 'Confidence',
  Patience: 'Patience',
  Discipline: 'Discipline',
};

/** Psychology tags generally regarded as constructive vs. destructive. */
export const POSITIVE_PSYCH: readonly PsychCode[] = ['Confidence', 'Patience', 'Discipline'];
export const NEGATIVE_PSYCH: readonly PsychCode[] = ['FOMO', 'Fear', 'Greed', 'Revenge'];
