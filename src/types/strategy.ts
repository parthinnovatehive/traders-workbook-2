import type { Computable, ISODateTime, UUID } from './common';

export interface Strategy {
  id: UUID;
  userId: UUID | null; // null => system default strategy
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: ISODateTime;
}

/** Aggregated performance for one strategy (Section 15). */
export interface StrategyPerformance {
  strategyId: UUID;
  name: string;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: Computable<number>;
  grossPnl: number;
  netPnl: number;
  averageProfit: Computable<number>;
  averageLoss: Computable<number>;
  averageR: Computable<number>;
  expectancy: Computable<number>;
  maxDrawdown: number;
  roi: Computable<number>;
  bestTrade: Computable<number>;
  worstTrade: Computable<number>;
}
