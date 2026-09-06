import type { Trade, TradeCalcInput } from '@/types';

/** Build a valid TradeCalcInput (winning long by default), overridable per test. */
export function calcInput(overrides: Partial<TradeCalcInput> = {}): TradeCalcInput {
  return {
    direction: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    stopLoss: 95,
    target: 120,
    charges: 0,
    ...overrides,
  };
}

let seq = 0;

/** Build a full Trade record for aggregate/performance tests. */
export function makeTrade(overrides: Partial<Trade> = {}): Trade {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: 'u1',
    entryDate: '2025-01-01',
    entryTime: '09:15',
    exitDate: '2025-01-01',
    exitTime: '10:00',
    symbol: 'TEST',
    market: 'Equity',
    direction: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    stopLoss: 95,
    target: 120,
    charges: 0,
    strategyId: null,
    psychology: [],
    mistakes: [],
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T10:00:00.000Z',
    ...overrides,
  };
}
