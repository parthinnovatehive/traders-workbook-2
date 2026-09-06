import { roundMoney } from '@/utils/money';

/**
 * Expectancy primitive (per-trade expected value, in currency):
 *   (Win Rate × Average Win) − (Loss Rate × Average Loss)
 * Rates are decimals (0..1); averageLoss is a positive magnitude.
 */
export function expectancy(
  winRate: number,
  averageWin: number,
  lossRate: number,
  averageLoss: number,
): number {
  return roundMoney(winRate * averageWin - lossRate * Math.abs(averageLoss));
}

/**
 * Expectancy computed directly from realized (closed-trade) net P&Ls.
 * Win/loss rates use the full closed-trade count as the denominator, so
 * breakeven trades correctly dilute both rates. Returns null with no trades.
 */
export function expectancyFromPnls(realizedPnls: readonly number[]): number | null {
  const n = realizedPnls.length;
  if (n === 0) return null;

  const wins = realizedPnls.filter((p) => p > 0);
  const losses = realizedPnls.filter((p) => p < 0);

  const winRate = wins.length / n;
  const lossRate = losses.length / n;

  const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const averageLoss =
    losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  return expectancy(winRate, averageWin, lossRate, averageLoss);
}
