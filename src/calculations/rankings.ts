import type { Trade } from '@/types';
import { NEGATIVE_PSYCH } from '@/constants/journal';
import { closedTradesInOrder } from './performance';
import { netPnl } from './pnl';
import { rMultiple } from './rmultiple';
import { riskReward } from './risk';
import { dailyPnlSeries, monthlyPnlSeries, type DailyPnlPoint, type MonthlyPnlPoint } from './series';

export interface RankedTrade {
  trade: Trade;
  netPnl: number;
  rMultiple: number | null;
  riskReward: number | null;
}

export function rankedClosedTrades(trades: readonly Trade[]): RankedTrade[] {
  return closedTradesInOrder(trades).map((trade) => ({
    trade,
    netPnl: netPnl(trade) ?? 0,
    rMultiple: rMultiple(trade),
    riskReward: riskReward(trade),
  }));
}

const take = <T>(xs: readonly T[], n: number): T[] => xs.slice(0, Math.max(0, n));

export function topTradesByProfit(trades: readonly Trade[], n = 5): RankedTrade[] {
  return take(rankedClosedTrades(trades).toSorted((a, b) => b.netPnl - a.netPnl), n);
}

export function worstTradesByProfit(trades: readonly Trade[], n = 5): RankedTrade[] {
  return take(rankedClosedTrades(trades).toSorted((a, b) => a.netPnl - b.netPnl), n);
}

export function topTradesByR(trades: readonly Trade[], n = 5): RankedTrade[] {
  return take(
    rankedClosedTrades(trades)
      .filter((r) => r.rMultiple !== null)
      .toSorted((a, b) => (b.rMultiple ?? 0) - (a.rMultiple ?? 0)),
    n,
  );
}

export function worstTradesByR(trades: readonly Trade[], n = 5): RankedTrade[] {
  return take(
    rankedClosedTrades(trades)
      .filter((r) => r.rMultiple !== null)
      .toSorted((a, b) => (a.rMultiple ?? 0) - (b.rMultiple ?? 0)),
    n,
  );
}

export function topTradesByRR(trades: readonly Trade[], n = 5): RankedTrade[] {
  return take(
    rankedClosedTrades(trades)
      .filter((r) => r.riskReward !== null)
      .toSorted((a, b) => (b.riskReward ?? 0) - (a.riskReward ?? 0)),
    n,
  );
}

export function worstPsychologyTrades(trades: readonly Trade[], n = 5): RankedTrade[] {
  const negative = new Set<string>(NEGATIVE_PSYCH);
  return take(
    rankedClosedTrades(trades)
      .filter((r) => r.trade.psychology.some((p) => negative.has(p)) && r.netPnl < 0)
      .toSorted((a, b) => a.netPnl - b.netPnl),
    n,
  );
}

export function worstRuleViolations(trades: readonly Trade[], n = 5): RankedTrade[] {
  return take(
    rankedClosedTrades(trades)
      .filter((r) => r.trade.mistakes.includes('RuleViolation'))
      .toSorted((a, b) => a.netPnl - b.netPnl),
    n,
  );
}

export function bestTradingDay(trades: readonly Trade[]): DailyPnlPoint | null {
  const days = dailyPnlSeries(trades);
  return days.reduce<DailyPnlPoint | null>((best, d) => (!best || d.netPnl > best.netPnl ? d : best), null);
}

export function worstTradingDay(trades: readonly Trade[]): DailyPnlPoint | null {
  const days = dailyPnlSeries(trades);
  return days.reduce<DailyPnlPoint | null>((worst, d) => (!worst || d.netPnl < worst.netPnl ? d : worst), null);
}

export function bestTradingMonth(trades: readonly Trade[]): MonthlyPnlPoint | null {
  const months = monthlyPnlSeries(trades);
  return months.reduce<MonthlyPnlPoint | null>(
    (best, m) => (!best || m.netPnl > best.netPnl ? m : best),
    null,
  );
}
