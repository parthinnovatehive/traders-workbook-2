import { isValidPrice } from './guards';
import { roundTo } from '@/utils/money';

/**
 * ROI (%) = Net P&L / Starting Capital * 100.
 * Returns null when net P&L is N/A or starting capital is not positive.
 */
export function roi(netPnlValue: number | null, startingCapital: number): number | null {
  if (netPnlValue === null) return null;
  if (!isValidPrice(startingCapital)) return null;
  return roundTo((netPnlValue / startingCapital) * 100, 2);
}
