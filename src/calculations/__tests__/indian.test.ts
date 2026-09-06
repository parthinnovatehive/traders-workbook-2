import { describe, expect, it } from 'vitest';
import { computeTradeMetrics } from '../index';
import { getIndianSpec } from '@/constants/indianInstruments';

describe('Indian instrument specs (configurable lot sizes)', () => {
  it('exposes exchange-defined lot sizes', () => {
    expect(getIndianSpec('NIFTY')?.lotSize).toBe(75);
    expect(getIndianSpec('BANKNIFTY')?.lotSize).toBe(35);
    expect(getIndianSpec('RELIANCE')?.lotSize).toBe(500);
    expect(getIndianSpec('ITC')?.lotSize).toBe(1); // cash equity
  });
  it('returns null for unknown symbols (no invented lot size)', () => {
    expect(getIndianSpec('UNKNOWNXYZ')).toBeNull();
  });
});

describe('Indian P&L via the shared engine (lot size as multiplier)', () => {
  it('BANK NIFTY: 100 pts × lot 35 × 1 lot = 3500 (INR account)', () => {
    const m = computeTradeMetrics({
      direction: 'long',
      entryPrice: 50000,
      exitPrice: 50100,
      quantity: 1,
      lotSize: getIndianSpec('BANKNIFTY')!.lotSize,
      stopLoss: 49900,
      target: 50300,
      charges: 0,
      conversionRate: 1,
    });
    expect(m.grossPnl).toBe(3500);
    expect(m.risk).toBe(3500); // 100 pts × 35
    expect(m.rMultiple).toBe(1);
  });

  it('Stock F&O (RELIANCE): 2 lots × 500 × 10 pts = 10,000', () => {
    const m = computeTradeMetrics({
      direction: 'long',
      entryPrice: 2950,
      exitPrice: 2960,
      quantity: 2,
      lotSize: 500,
      stopLoss: 2945,
      target: 2975,
      charges: 0,
      conversionRate: 1,
    });
    expect(m.grossPnl).toBe(10000);
  });

  it('a configurable lot-size change flows straight through the engine', () => {
    const base = { direction: 'long' as const, entryPrice: 100, exitPrice: 110, quantity: 1, stopLoss: 95, target: 120, charges: 0, conversionRate: 1 };
    expect(computeTradeMetrics({ ...base, lotSize: 50 }).grossPnl).toBe(500);
    expect(computeTradeMetrics({ ...base, lotSize: 100 }).grossPnl).toBe(1000);
  });
});
