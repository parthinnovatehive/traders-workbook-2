/**
 * Forex calculation engine — pure, deterministic, currency-aware.
 * No React, no I/O. FX rates are passed in explicitly (captured from the FX
 * provider at trade time) so results are reproducible.
 */
import { directionSign } from './pnl';
import type { TradeDirection } from '@/types';
import { roundMoney, roundTo } from '@/utils/money';

const positive = (n: number): boolean => Number.isFinite(n) && n > 0;

/** Number of pips between two prices for a given pip size. */
export function calculatePipDistance(entry: number, other: number, pipSize: number): number | null {
  if (!Number.isFinite(entry) || !Number.isFinite(other) || !positive(pipSize)) return null;
  return roundTo(Math.abs(entry - other) / pipSize, 1);
}

/**
 * Value of ONE pip, in the account currency, for a position of `units`.
 *   pipValue = pipSize × units × rate(quote → account)
 */
export function calculateForexPipValue(
  pipSize: number,
  units: number,
  quoteToAccountRate = 1,
): number | null {
  if (!positive(pipSize) || !positive(units) || !positive(quoteToAccountRate)) return null;
  return roundMoney(pipSize * units * quoteToAccountRate);
}

/** Position size (units) from a number of lots. */
export function calculatePositionSize(lots: number, unitsPerLot: number): number | null {
  if (!positive(lots) || !positive(unitsPerLot)) return null;
  return roundTo(lots * unitsPerLot, 2);
}

export interface LotSizeParams {
  riskAmount: number; // in account currency
  stopPips: number;
  pipSize: number;
  unitsPerLot: number; // units in one lot of the chosen lot type
  quoteToAccountRate?: number; // rate(quote → account)
  minLot?: number;
  maxLot?: number;
  lotStep?: number;
}

/**
 * Lot size from a risk budget:
 *   lots = riskAmount / (stopPips × pipValuePerLot)
 * where pipValuePerLot = pipSize × unitsPerLot × rate(quote → account).
 * Result is floored to the lot step and clamped to [0, maxLot].
 */
export function calculateLotSize(params: LotSizeParams): number | null {
  const {
    riskAmount,
    stopPips,
    pipSize,
    unitsPerLot,
    quoteToAccountRate = 1,
    maxLot = 100,
    lotStep = 0.01,
  } = params;
  if (!positive(riskAmount) || !positive(stopPips) || !positive(pipSize)) return null;
  if (!positive(unitsPerLot) || !positive(quoteToAccountRate)) return null;

  const pipValuePerLot = pipSize * unitsPerLot * quoteToAccountRate;
  if (!positive(pipValuePerLot)) return null;

  const raw = riskAmount / (stopPips * pipValuePerLot);
  const stepped = lotStep > 0 ? Math.floor(raw / lotStep) * lotStep : raw;
  const clamped = Math.min(Math.max(stepped, 0), maxLot);
  return roundTo(clamped, 2);
}

/** Convert an amount using an explicit rate (rate = units of target per source). */
export function convertCurrency(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !positive(rate)) return amount;
  return roundMoney(amount * rate);
}

export interface ForexPnlParams {
  entry: number;
  exit: number;
  lots: number;
  unitsPerLot: number;
  direction: TradeDirection;
  quoteToAccountRate?: number;
}

/**
 * Gross P&L of a forex trade in the account currency:
 *   (exit − entry) × sign × lots × unitsPerLot × rate(quote → account)
 * Mirrors the core engine's multiplier model, provided for clarity/testing.
 */
export function calculateForexPnl(params: ForexPnlParams): number | null {
  const { entry, exit, lots, unitsPerLot, direction, quoteToAccountRate = 1 } = params;
  if (!positive(entry) || !positive(exit) || !positive(lots) || !positive(unitsPerLot)) return null;
  if (!positive(quoteToAccountRate)) return null;
  const units = lots * unitsPerLot;
  return roundMoney(directionSign(direction) * (exit - entry) * units * quoteToAccountRate);
}
