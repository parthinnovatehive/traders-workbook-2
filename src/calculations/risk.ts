import type { TradeCalcInput } from '@/types';
import { roundMoney, roundTo } from '@/utils/money';
import { isValidPrice, isValidQuantity } from './guards';
import { sizeMultiplier } from './units';

type RiskInput = Pick<
  TradeCalcInput,
  'entryPrice' | 'stopLoss' | 'quantity' | 'lotSize' | 'conversionRate'
>;
type RewardInput = Pick<
  TradeCalcInput,
  'entryPrice' | 'target' | 'quantity' | 'lotSize' | 'conversionRate'
>;

/**
 * Initial risk = |Entry - Stop Loss| × Position Size × lotSize × conversionRate,
 * expressed in the account currency. Returns null when the stop loss is missing
 * or inputs are invalid (=> R is N/A).
 */
export function initialRisk(trade: RiskInput): number | null {
  const { entryPrice, stopLoss, quantity } = trade;
  if (stopLoss === null || stopLoss === undefined) return null;
  if (!isValidPrice(entryPrice) || !isValidPrice(stopLoss) || !isValidQuantity(quantity)) {
    return null;
  }
  return roundMoney(Math.abs(entryPrice - stopLoss) * quantity * sizeMultiplier(trade));
}

/**
 * Planned reward = |Target - Entry| × Position Size × lotSize × conversionRate.
 * Returns null when the target is missing or inputs are invalid.
 */
export function plannedReward(trade: RewardInput): number | null {
  const { entryPrice, target, quantity } = trade;
  if (target === null || target === undefined) return null;
  if (!isValidPrice(entryPrice) || !isValidPrice(target) || !isValidQuantity(quantity)) {
    return null;
  }
  return roundMoney(Math.abs(target - entryPrice) * quantity * sizeMultiplier(trade));
}

/**
 * Planned Risk/Reward = Reward / Risk.
 * Returns null when either side is N/A or risk is zero.
 */
export function riskReward(trade: RiskInput & RewardInput): number | null {
  const risk = initialRisk(trade);
  const reward = plannedReward(trade);
  if (risk === null || reward === null || risk === 0) return null;
  return roundTo(reward / risk, 2);
}
