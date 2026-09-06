import type { TradeCalcInput } from '@/types';
import { roundTo } from '@/utils/money';
import { netPnl } from './pnl';
import { initialRisk } from './risk';

/**
 * R Multiple = Actual Net P&L / Initial Risk.
 * Returns null when risk is N/A (no stop), risk is zero, or the trade is open.
 */
export function rMultiple(trade: TradeCalcInput): number | null {
  const risk = initialRisk(trade);
  if (risk === null || risk === 0) return null;
  const net = netPnl(trade);
  if (net === null) return null;
  return roundTo(net / risk, 2);
}
