import { describe, expect, it } from 'vitest';
import {
  calculateForexPipValue,
  calculateForexPnl,
  calculateLotSize,
  calculatePipDistance,
  calculatePositionSize,
  computeTradeMetrics,
  convertCurrency,
} from '../index';
import { getForexSpec, LOT_UNITS } from '@/constants/instruments';

// Mock rates (quote → account) used explicitly for determinism.
const USD_PER_JPY = 1 / 150;
const USD_PER_GBP = 1 / 0.79;
const INR_PER_USD = 83;
const EUR_PER_USD = 0.92;

describe('instrument specs', () => {
  it('derives pip size correctly (JPY pairs use 0.01)', () => {
    expect(getForexSpec('EUR/USD')?.pipSize).toBe(0.0001);
    expect(getForexSpec('USD/JPY')?.pipSize).toBe(0.01);
    expect(getForexSpec('GBPJPY')?.quote).toBe('JPY');
  });
});

describe('calculatePipDistance', () => {
  it('counts pips between prices', () => {
    expect(calculatePipDistance(1.1, 1.105, 0.0001)).toBe(50);
    expect(calculatePipDistance(150, 151, 0.01)).toBe(100);
  });
});

describe('calculateForexPipValue (account currency)', () => {
  it('EUR/USD standard lot, USD account => $10/pip', () => {
    expect(calculateForexPipValue(0.0001, LOT_UNITS.standard, 1)).toBe(10);
  });
  it('USD/JPY standard lot, USD account => ~$6.67/pip', () => {
    expect(calculateForexPipValue(0.01, LOT_UNITS.standard, USD_PER_JPY)).toBe(6.67);
  });
  it('EUR/GBP standard lot, USD account (GBP→USD)', () => {
    expect(calculateForexPipValue(0.0001, LOT_UNITS.standard, USD_PER_GBP)).toBe(12.66);
  });
  it('EUR/USD standard lot, INR account => ₹830/pip', () => {
    expect(calculateForexPipValue(0.0001, LOT_UNITS.standard, INR_PER_USD)).toBe(830);
  });
});

describe('calculateForexPnl', () => {
  it('EUR/USD long 50 pips, 1 standard lot, USD => +$500', () => {
    expect(
      calculateForexPnl({ entry: 1.1, exit: 1.105, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'long' }),
    ).toBe(500);
  });
  it('EUR/USD short 50 pips profit => +$500', () => {
    expect(
      calculateForexPnl({ entry: 1.105, exit: 1.1, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'short' }),
    ).toBe(500);
  });
  it('USD/JPY long 100 pips, USD account => ~$666.67', () => {
    expect(
      calculateForexPnl({ entry: 150, exit: 151, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'long', quoteToAccountRate: USD_PER_JPY }),
    ).toBe(666.67);
  });
  it('GBP/JPY long 100 pips, USD account => ~$666.67', () => {
    expect(
      calculateForexPnl({ entry: 190, exit: 191, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'long', quoteToAccountRate: USD_PER_JPY }),
    ).toBe(666.67);
  });
  it('EUR/GBP long 50 pips, USD account => ~$632.91', () => {
    expect(
      calculateForexPnl({ entry: 0.85, exit: 0.855, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'long', quoteToAccountRate: USD_PER_GBP }),
    ).toBe(632.91);
  });
  it('EUR/USD 50 pips with INR account => ₹41,500', () => {
    expect(
      calculateForexPnl({ entry: 1.1, exit: 1.105, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'long', quoteToAccountRate: INR_PER_USD }),
    ).toBe(41500);
  });
  it('EUR/USD 50 pips with EUR account => €460', () => {
    expect(
      calculateForexPnl({ entry: 1.1, exit: 1.105, lots: 1, unitsPerLot: LOT_UNITS.standard, direction: 'long', quoteToAccountRate: EUR_PER_USD }),
    ).toBe(460);
  });
  it('mini and micro lots scale down', () => {
    expect(calculateForexPnl({ entry: 1.1, exit: 1.105, lots: 1, unitsPerLot: LOT_UNITS.mini, direction: 'long' })).toBe(50);
    expect(calculateForexPnl({ entry: 1.1, exit: 1.105, lots: 1, unitsPerLot: LOT_UNITS.micro, direction: 'long' })).toBe(5);
  });
});

describe('calculateLotSize', () => {
  it('EUR/USD: $100 risk, 50 pip stop => 0.20 lots', () => {
    expect(
      calculateLotSize({ riskAmount: 100, stopPips: 50, pipSize: 0.0001, unitsPerLot: LOT_UNITS.standard }),
    ).toBe(0.2);
  });
  it('USD/JPY (USD account): $100 risk, 50 pip stop => ~0.30 lots', () => {
    expect(
      calculateLotSize({ riskAmount: 100, stopPips: 50, pipSize: 0.01, unitsPerLot: LOT_UNITS.standard, quoteToAccountRate: USD_PER_JPY }),
    ).toBe(0.3);
  });
  it('returns null on invalid input', () => {
    expect(calculateLotSize({ riskAmount: 0, stopPips: 50, pipSize: 0.0001, unitsPerLot: 100000 })).toBeNull();
  });
});

describe('calculatePositionSize & convertCurrency', () => {
  it('position size = lots × unitsPerLot', () => {
    expect(calculatePositionSize(0.2, LOT_UNITS.standard)).toBe(20000);
  });
  it('convertCurrency applies the rate', () => {
    expect(convertCurrency(500, INR_PER_USD)).toBe(41500);
    expect(convertCurrency(500, 1)).toBe(500);
  });
});

describe('currency-aware core engine (computeTradeMetrics)', () => {
  it('forex trade via lotSize + conversionRate multipliers', () => {
    // EUR/USD, 1 std lot, 50-pip win, USD account
    const m = computeTradeMetrics({
      direction: 'long',
      entryPrice: 1.1,
      exitPrice: 1.105,
      quantity: 1,
      lotSize: LOT_UNITS.standard,
      stopLoss: 1.095,
      target: 1.115,
      charges: 0,
      conversionRate: 1,
    });
    expect(m.grossPnl).toBe(500);
    expect(m.risk).toBe(500); // 50 pips × $10
    expect(m.rMultiple).toBe(1); // 500 / 500
  });

  it('Indian NIFTY future (lot size 75), INR account', () => {
    const m = computeTradeMetrics({
      direction: 'long',
      entryPrice: 22000,
      exitPrice: 22100,
      quantity: 1,
      lotSize: 75,
      stopLoss: 21950,
      target: 22200,
      charges: 0,
      conversionRate: 1,
    });
    expect(m.grossPnl).toBe(7500); // 100 pts × 75
    expect(m.risk).toBe(3750); // 50 pts × 75
    expect(m.rMultiple).toBe(2);
  });
});
