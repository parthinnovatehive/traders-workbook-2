/**
 * Default (system) strategies. Users start with these and can add custom ones.
 * `id`s are stable slugs so seeded/mock data can reference them deterministically.
 */

export interface SystemStrategyDef {
  id: string;
  name: string;
  description: string;
}

export const DEFAULT_STRATEGIES: readonly SystemStrategyDef[] = [
  { id: 'sys-smc', name: 'SMC', description: 'Smart Money Concepts' },
  { id: 'sys-order-flow', name: 'Order Flow', description: 'Order flow / footprint reading' },
  { id: 'sys-price-action', name: 'Price Action', description: 'Naked price action' },
  { id: 'sys-breakout', name: 'Breakout', description: 'Range / level breakout' },
  { id: 'sys-reversal', name: 'Reversal', description: 'Counter-trend reversal' },
  { id: 'sys-scalping', name: 'Scalping', description: 'Very short-term scalps' },
  { id: 'sys-swing', name: 'Swing', description: 'Multi-day swing trades' },
  { id: 'sys-none', name: 'None', description: 'No defined strategy' },
] as const;

export const DEFAULT_STRATEGY_IDS = DEFAULT_STRATEGIES.map((s) => s.id);
