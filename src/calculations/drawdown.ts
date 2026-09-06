import type { EquityPoint, ISODate } from '@/types';
import { roundMoney, roundTo } from '@/utils/money';

/**
 * Build an equity curve from realized (closed-trade) P&Ls in chronological order.
 * Index 0 is the starting-capital baseline; each subsequent point is the running
 * capital after applying that trade's net P&L, plus the peak-to-trough drawdown.
 */
export function buildEquityCurve(
  realizedPnls: readonly number[],
  startingCapital: number,
  dates?: readonly (ISODate | undefined)[],
): EquityPoint[] {
  const points: EquityPoint[] = [];
  let equity = roundMoney(startingCapital);
  let peak = equity;

  points.push({ index: 0, equity, drawdown: 0 });

  realizedPnls.forEach((pnl, i) => {
    equity = roundMoney(equity + pnl);
    if (equity > peak) peak = equity;
    points.push({
      index: i + 1,
      equity,
      drawdown: roundMoney(peak - equity),
      date: dates?.[i],
    });
  });

  return points;
}

/** Maximum absolute peak-to-trough decline across an equity curve. */
export function maxDrawdownFromCurve(curve: readonly EquityPoint[]): number {
  return curve.reduce((max, p) => (p.drawdown > max ? p.drawdown : max), 0);
}

/** Maximum absolute drawdown from realized P&Ls (convenience wrapper). */
export function maxDrawdown(realizedPnls: readonly number[], startingCapital: number): number {
  return maxDrawdownFromCurve(buildEquityCurve(realizedPnls, startingCapital));
}

/**
 * Maximum drawdown as a percentage of the running peak.
 * Returns null when starting capital is not positive.
 */
export function maxDrawdownPct(
  realizedPnls: readonly number[],
  startingCapital: number,
): number | null {
  if (!(startingCapital > 0)) return null;
  const curve = buildEquityCurve(realizedPnls, startingCapital);
  let peak = startingCapital;
  let maxPct = 0;
  for (const p of curve) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const pct = ((peak - p.equity) / peak) * 100;
      if (pct > maxPct) maxPct = pct;
    }
  }
  return roundTo(maxPct, 2);
}
