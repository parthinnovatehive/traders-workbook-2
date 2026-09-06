import type { AccountMetrics, ISODate, Trade } from '@/types';
import { roundMoney, roundTo } from '@/utils/money';
import { buildEquityCurve, maxDrawdownFromCurve, maxDrawdownPct } from './drawdown';
import { expectancyFromPnls } from './expectancy';
import { isClosed } from './guards';
import { grossPnl, netPnl } from './pnl';
import { rMultiple } from './rmultiple';
import { roi } from './roi';

/** Sortable key for realization order: exit datetime, falling back to entry. */
function realizationKey(t: Trade): string {
  const date = t.exitDate ?? t.entryDate;
  const time = t.exitTime ?? t.entryTime ?? '00:00';
  return `${date}T${time}`;
}

/** Closed trades ordered by when their P&L was realized. */
export function closedTradesInOrder(trades: readonly Trade[]): Trade[] {
  return trades
    .filter((t) => isClosed(t.exitPrice))
    .toSorted((a, b) => realizationKey(a).localeCompare(realizationKey(b)));
}

/** Win Rate (%) = winning trades / closed trades × 100. Null with no closed trades. */
export function winRate(realizedPnls: readonly number[]): number | null {
  if (realizedPnls.length === 0) return null;
  const wins = realizedPnls.filter((p) => p > 0).length;
  return roundTo((wins / realizedPnls.length) * 100, 2);
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * The account-level aggregate over a set of trades. This single function powers
 * the dashboard for every date filter — callers pass the filtered trade set.
 * `startingCapital` is the baseline for ROI, drawdown and ending capital.
 */
export function computeAccountMetrics(
  trades: readonly Trade[],
  startingCapital: number,
): AccountMetrics {
  const closed = closedTradesInOrder(trades);
  const closedCount = closed.length;
  const openTrades = trades.length - closedCount;

  const nets: number[] = [];
  const dates: (ISODate | undefined)[] = [];
  const rMultiples: number[] = [];
  let grossTotal = 0;

  for (const t of closed) {
    const net = netPnl(t) ?? 0;
    nets.push(net);
    dates.push(t.exitDate ?? t.entryDate);
    grossTotal += grossPnl(t) ?? 0;
    const r = rMultiple(t);
    if (r !== null) rMultiples.push(r);
  }

  const netTotal = roundMoney(nets.reduce((a, b) => a + b, 0));
  grossTotal = roundMoney(grossTotal);
  const totalCharges = roundMoney(grossTotal - netTotal);

  const winsArr = nets.filter((p) => p > 0);
  const lossesArr = nets.filter((p) => p < 0);
  const winningTrades = winsArr.length;
  const losingTrades = lossesArr.length;
  const breakevenTrades = nets.filter((p) => p === 0).length;

  const grossProfit = winsArr.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(lossesArr.reduce((a, b) => a + b, 0));

  const curve = buildEquityCurve(nets, startingCapital, dates);

  return {
    totalTrades: trades.length,
    closedTrades: closedCount,
    openTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,

    grossPnl: grossTotal,
    netPnl: netTotal,
    totalCharges,

    winRate: winRate(nets),
    lossRate: closedCount > 0 ? roundTo((losingTrades / closedCount) * 100, 2) : null,
    averageWin: winningTrades > 0 ? roundMoney(mean(winsArr)) : null,
    averageLoss: losingTrades > 0 ? roundMoney(Math.abs(mean(lossesArr))) : null,
    averageR: rMultiples.length > 0 ? roundTo(mean(rMultiples), 2) : null,
    expectancy: expectancyFromPnls(nets),
    profitFactor: grossLoss > 0 ? roundTo(grossProfit / grossLoss, 2) : null,
    roi: roi(netTotal, startingCapital),

    maxDrawdown: maxDrawdownFromCurve(curve),
    maxDrawdownPct: maxDrawdownPct(nets, startingCapital),

    bestTrade: closedCount > 0 ? roundMoney(nets.reduce((m, p) => Math.max(m, p), -Infinity)) : null,
    worstTrade: closedCount > 0 ? roundMoney(nets.reduce((m, p) => Math.min(m, p), Infinity)) : null,

    startingCapital: roundMoney(startingCapital),
    endingCapital: roundMoney(startingCapital + netTotal),
  };
}
