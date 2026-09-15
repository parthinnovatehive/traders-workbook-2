import type { ISODate, Trade } from '@/types';
import { roundMoney } from '@/utils/money';
import { isClosed } from './guards';
import { initialRisk, riskReward } from './risk';
import { sizeMultiplier } from './units';

/**
 * Open positions.
 *
 * Every performance metric in the app is computed from CLOSED trades, which is
 * correct — an open trade has no realized P&L to measure. But that left open
 * positions with nowhere to appear at all: recorded, counted against the trade
 * limit, and then invisible until the day they were closed.
 *
 * What is shown here is deliberately limited to what the journal actually
 * knows. There is no market data feed, so there is no unrealized P&L and none
 * is invented — only committed capital, the loss the stop would take, and how
 * long the position has been carried.
 */

export interface OpenPosition {
  trade: Trade;
  /** Units (or shares) actually held: quantity × lot/contract size. */
  positionSize: number;
  /** Capital committed at entry, in the account currency. */
  exposure: number;
  /** What the stop would cost if hit. Null when no stop was recorded. */
  riskAtStop: number | null;
  /** Planned reward-to-risk. Null without both a stop and a target. */
  plannedRr: number | null;
  daysOpen: number;
}

export interface OpenPositionSummary {
  positions: OpenPosition[];
  count: number;
  totalExposure: number;
  /** Sum of the known stop risks. Excludes positions with no stop. */
  totalRiskAtStop: number;
  /** Open positions carrying no stop loss — unbounded downside. */
  unprotected: number;
}

const MS_PER_DAY = 86_400_000;

/** Whole days between two ISO dates, floored at 0. */
function daysBetween(from: ISODate, to: ISODate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / MS_PER_DAY));
}

/**
 * Every still-open trade, most recently opened first.
 *
 * `asOf` is passed in rather than read from the clock so this stays pure and
 * testable, in line with the rest of the engine.
 */
export function openPositions(trades: readonly Trade[], asOf: ISODate): OpenPositionSummary {
  const positions: OpenPosition[] = [];

  for (const trade of trades) {
    if (isClosed(trade.exitPrice)) continue;

    const size = trade.quantity * (trade.lotSize && trade.lotSize > 0 ? trade.lotSize : 1);
    const exposure = roundMoney(
      Math.abs(trade.entryPrice) * trade.quantity * sizeMultiplier(trade),
    );

    positions.push({
      trade,
      positionSize: size,
      exposure: Number.isFinite(exposure) ? exposure : 0,
      riskAtStop: initialRisk(trade),
      plannedRr: riskReward(trade),
      daysOpen: daysBetween(trade.entryDate, asOf),
    });
  }

  positions.sort((a, b) => b.trade.entryDate.localeCompare(a.trade.entryDate));

  return {
    positions,
    count: positions.length,
    totalExposure: roundMoney(positions.reduce((sum, p) => sum + p.exposure, 0)),
    totalRiskAtStop: roundMoney(
      positions.reduce((sum, p) => sum + (p.riskAtStop ?? 0), 0),
    ),
    unprotected: positions.filter((p) => p.riskAtStop === null).length,
  };
}
