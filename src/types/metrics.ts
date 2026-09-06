import type { Computable, ISODate } from './common';

/** A point on the equity curve (running capital after each closed trade). */
export interface EquityPoint {
  index: number;
  date?: ISODate;
  equity: number;
  drawdown: number; // absolute decline from the running peak (>= 0)
}

/** Aggregated, account-level metrics over a set of trades (Section 8). */
export interface AccountMetrics {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;

  grossPnl: number;
  netPnl: number;
  totalCharges: number;

  winRate: Computable<number>;
  lossRate: Computable<number>;
  averageWin: Computable<number>;
  averageLoss: Computable<number>; // positive magnitude
  averageR: Computable<number>;
  expectancy: Computable<number>;
  profitFactor: Computable<number>;
  roi: Computable<number>;

  maxDrawdown: number; // absolute
  maxDrawdownPct: Computable<number>;

  bestTrade: Computable<number>;
  worstTrade: Computable<number>;

  startingCapital: number;
  endingCapital: number;
}
