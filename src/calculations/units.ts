import type { TradeCalcInput } from '@/types';
import { isFiniteNumber } from '@/utils/money';

const posOrOne = (n: number | null | undefined): number => (isFiniteNumber(n) && n > 0 ? n : 1);

/**
 * Combined size multiplier applied to price-difference calculations:
 *   contract/lot size × currency conversion (quote → account).
 * Both default to 1, so legacy trades (shares priced in the account currency)
 * behave exactly as before.
 */
export function sizeMultiplier(input: Pick<TradeCalcInput, 'lotSize' | 'conversionRate'>): number {
  return posOrOne(input.lotSize) * posOrOne(input.conversionRate);
}
