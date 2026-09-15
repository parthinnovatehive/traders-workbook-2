import { describe, expect, it } from 'vitest';
import { computeTradeMetrics } from '../index';
import { getIndianSpec, lotSizeFor } from '@/constants/indianInstruments';

describe('Indian instrument specs (configurable lot sizes)', () => {
  // Deliberately NOT pinned to specific numbers: NSE/BSE revise F&O lot sizes
  // several times a year, so asserting "BANKNIFTY is 35" makes the suite fail
  // every revision without any bug existing. What must hold is the shape —
  // indices and F&O names carry a real multiplier, cash equity carries 1.
  it('gives indices and F&O names a multi-unit contract', () => {
    expect(getIndianSpec('NIFTY')?.lotSize).toBeGreaterThan(1);
    expect(getIndianSpec('BANKNIFTY')?.lotSize).toBeGreaterThan(1);
    expect(getIndianSpec('RELIANCE')?.lotSize).toBeGreaterThan(1);
  });

  it('uses a multiplier of 1 for a cash-only name', () => {
    const cashOnly = getIndianSpec('BATAINDIA');
    expect(cashOnly?.hasFno).toBe(false);
    expect(cashOnly?.lotSize).toBe(1);
  });

  it('uses a multiplier of 1 when an F&O name is traded in the cash segment', () => {
    const reliance = getIndianSpec('RELIANCE')!;
    expect(lotSizeFor(reliance, 'EQ')).toBe(1);
  });

  it('returns null for unknown symbols (no invented lot size)', () => {
    expect(getIndianSpec('UNKNOWNXYZ')).toBeNull();
  });
});

describe('Indian P&L via the shared engine (lot size as multiplier)', () => {
  it('multiplies index points by whatever the spec says the lot is', () => {
    const lotSize = getIndianSpec('BANKNIFTY')!.lotSize;
    const m = computeTradeMetrics({
      direction: 'long',
      entryPrice: 50000,
      exitPrice: 50100, // +100 points
      quantity: 1,
      lotSize,
      stopLoss: 49900, // -100 points
      target: 50300,
      charges: 0,
      conversionRate: 1,
    });
    expect(m.grossPnl).toBe(100 * lotSize);
    expect(m.risk).toBe(100 * lotSize);
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
