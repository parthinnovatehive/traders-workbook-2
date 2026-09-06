import type { Strategy, StrategyPerformance, Trade } from '@/types';
import { computeAccountMetrics } from './performance';

const UNASSIGNED = '__unassigned__';

/**
 * Per-strategy performance (Section 15). Groups trades by strategy and reuses
 * the account-metrics engine so every strategy card shares one calculation path.
 */
export function computeStrategyPerformance(
  trades: readonly Trade[],
  strategies: readonly Strategy[],
  startingCapital: number,
): StrategyPerformance[] {
  const nameById = new Map<string, string>();
  for (const s of strategies) nameById.set(s.id, s.name);

  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.strategyId ?? UNASSIGNED;
    const bucket = groups.get(key);
    if (bucket) bucket.push(t);
    else groups.set(key, [t]);
  }

  const rows: StrategyPerformance[] = [];
  for (const [key, group] of groups) {
    const m = computeAccountMetrics(group, startingCapital);
    rows.push({
      strategyId: key,
      name: key === UNASSIGNED ? 'Unassigned' : (nameById.get(key) ?? 'Unknown'),
      totalTrades: m.totalTrades,
      wins: m.winningTrades,
      losses: m.losingTrades,
      breakevens: m.breakevenTrades,
      winRate: m.winRate,
      grossPnl: m.grossPnl,
      netPnl: m.netPnl,
      averageProfit: m.averageWin,
      averageLoss: m.averageLoss,
      averageR: m.averageR,
      expectancy: m.expectancy,
      maxDrawdown: m.maxDrawdown,
      roi: m.roi,
      bestTrade: m.bestTrade,
      worstTrade: m.worstTrade,
    });
  }

  // Most profitable first.
  return rows.toSorted((a, b) => b.netPnl - a.netPnl);
}
