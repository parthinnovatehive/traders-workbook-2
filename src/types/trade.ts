import type { Market, MistakeCode, PsychCode } from '@/constants/journal';
import type { Computable, ISODate, ISOTime, ISODateTime, UUID } from './common';

export const TRADING_MODES = ['forex', 'indian'] as const;
export type TradingMode = (typeof TRADING_MODES)[number];

export const TRADE_DIRECTIONS = ['long', 'short'] as const;
export type TradeDirection = (typeof TRADE_DIRECTIONS)[number];

export const TRADE_STATUSES = ['open', 'closed'] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const TRADE_OUTCOMES = ['win', 'loss', 'breakeven'] as const;
export type TradeOutcome = (typeof TRADE_OUTCOMES)[number];

/**
 * A single trade record — the raw, user-entered source of truth.
 * Calculated metrics are NEVER stored here; they are derived by the engine.
 *
 * A trade is "open" until `exitPrice` is set (then it is "closed").
 * `stopLoss` / `target` are optional: when absent, risk-based metrics are N/A.
 */
export interface Trade {
  id: UUID;
  userId: UUID;

  // Trading mode (forex vs Indian market). Optional for legacy trades.
  tradingMode?: TradingMode;

  // Timing
  entryDate: ISODate;
  entryTime?: ISOTime;
  exitDate?: ISODate;
  exitTime?: ISOTime;

  // Instrument
  symbol: string;
  market: Market;
  direction: TradeDirection;

  // Forex instrument metadata
  baseCurrency?: string;
  quoteCurrency?: string;
  lotType?: string; // 'standard' | 'mini' | 'micro' | 'nano'

  // Indian instrument metadata
  exchange?: string;
  segment?: string;

  // Currency of the account this trade contributes P&L to (defaults to user's).
  accountCurrency?: string;

  // Prices & size
  entryPrice: number;
  exitPrice: number | null; // null => open trade
  quantity: number; // forex: number of lots; indian: lots or shares
  lotSize?: number; // units per lot / contract multiplier (default 1)
  stopLoss: number | null;
  target: number | null;
  charges: number; // total costs (commission + fees + taxes); >= 0, in account currency

  // Conversion rate (settlement/quote currency → account currency), captured at
  // entry time so the pure engine stays deterministic. Defaults to 1.
  conversionRate?: number;

  // Forex derived (display) values captured at entry.
  pipDistance?: number;
  pipValue?: number;

  // Classification
  strategyId: UUID | null;
  setup?: string;
  marketCondition?: string;

  // Journaling
  notes?: string;
  psychology: PsychCode[];
  mistakes: MistakeCode[];

  // Audit
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** The minimal shape the calculation engine needs — keeps calc fns decoupled. */
export type TradeCalcInput = Pick<
  Trade,
  | 'direction'
  | 'entryPrice'
  | 'exitPrice'
  | 'quantity'
  | 'stopLoss'
  | 'target'
  | 'charges'
  | 'lotSize'
  | 'conversionRate'
>;

/** Per-trade derived metrics. `null` means "not computable" and renders as N/A. */
export interface TradeMetrics {
  status: TradeStatus;
  grossPnl: Computable<number>;
  netPnl: Computable<number>;
  outcome: Computable<TradeOutcome>;
  risk: Computable<number>;
  reward: Computable<number>;
  riskReward: Computable<number>;
  rMultiple: Computable<number>;
  roi: Computable<number>; // vs. starting capital, when provided
}

/** Draft used by the trade entry form before an id/audit fields exist. */
export type TradeDraft = Omit<Trade, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
