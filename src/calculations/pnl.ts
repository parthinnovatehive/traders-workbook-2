import type { TradeCalcInput, TradeDirection, TradeOutcome } from '@/types';
import { isFiniteNumber, roundMoney } from '@/utils/money';
import { isValidPrice, isValidQuantity } from './guards';
import { sizeMultiplier } from './units';

export const directionSign = (direction: TradeDirection): 1 | -1 =>
  direction === 'long' ? 1 : -1;

type PnlInput = Pick<
  TradeCalcInput,
  'direction' | 'entryPrice' | 'exitPrice' | 'quantity' | 'lotSize' | 'conversionRate'
>;

/**
 * Gross P&L — profit before charges, in the account currency.
 *   (exit - entry) × sign × quantity × lotSize × conversionRate
 * `lotSize` (contract/lot units) and `conversionRate` (quote → account) default
 * to 1, so a plain share trade priced in the account currency is unchanged.
 * Returns null for open trades or invalid prices/quantity.
 */
export function grossPnl(trade: PnlInput): number | null {
  const { direction, entryPrice, exitPrice, quantity } = trade;
  if (exitPrice === null || exitPrice === undefined) return null; // open trade
  if (!isValidPrice(entryPrice) || !isValidPrice(exitPrice) || !isValidQuantity(quantity)) {
    return null;
  }
  return roundMoney(
    directionSign(direction) * (exitPrice - entryPrice) * quantity * sizeMultiplier(trade),
  );
}

/** Net P&L = Gross P&L - Charges. */
export function netPnl(trade: Pick<TradeCalcInput, keyof PnlInput | 'charges'>): number | null {
  const gross = grossPnl(trade);
  if (gross === null) return null;
  const charges = isFiniteNumber(trade.charges) && trade.charges > 0 ? trade.charges : 0;
  return roundMoney(gross - charges);
}

/** Classify a realized net P&L into win / loss / breakeven. */
export function tradeOutcome(net: number | null): TradeOutcome | null {
  if (net === null) return null;
  if (net > 0) return 'win';
  if (net < 0) return 'loss';
  return 'breakeven';
}
