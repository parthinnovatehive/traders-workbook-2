import { describe, expect, it } from 'vitest';
import {
  FOREX_SPECS,
  getForexSpec,
  LOT_MULTIPLIERS,
  unitsPerLot,
} from '../instruments';
import {
  getIndianSpec,
  INDIAN_INSTRUMENTS,
  lotSizeFor,
  marketForSegment,
  segmentsFor,
} from '../indianInstruments';
import { calculateForexPipValue } from '@/calculations/forex';

describe('forex contract specs', () => {
  it('gives every currency pair a 100,000-unit standard lot', () => {
    const currencyPairs = FOREX_SPECS.filter(
      (s) => s.category === 'major' || s.category === 'minor' || s.category === 'exotic',
    );

    expect(currencyPairs.length).toBeGreaterThan(50);
    expect(currencyPairs.every((s) => s.contractSize === 100_000)).toBe(true);
  });

  it('uses a 0.01 pip for JPY-quoted pairs and 0.0001 otherwise', () => {
    expect(getForexSpec('USD/JPY')?.pipSize).toBe(0.01);
    expect(getForexSpec('GBP/JPY')?.pipSize).toBe(0.01);
    expect(getForexSpec('EUR/USD')?.pipSize).toBe(0.0001);
    expect(getForexSpec('GBP/CHF')?.pipSize).toBe(0.0001);
  });

  // The bug this fixes: gold was treated as a 100,000-unit pair with a 0.0001
  // pip, overstating P&L by roughly 1000x.
  it('prices gold as a 100-ounce contract with a 0.01 pip', () => {
    const xau = getForexSpec('XAU/USD');

    expect(xau?.contractSize).toBe(100);
    expect(xau?.pipSize).toBe(0.01);
  });

  it('prices silver as a 5,000-ounce contract', () => {
    const xag = getForexSpec('XAG/USD');

    expect(xag?.contractSize).toBe(5000);
    expect(xag?.pipSize).toBe(0.001);
  });

  it('treats crypto as a single-unit contract', () => {
    expect(getForexSpec('BTC/USD')?.contractSize).toBe(1);
  });

  it('still derives a usable spec for an uncurated pair', () => {
    const spec = getForexSpec('EUR/HKD');

    expect(spec).toMatchObject({ base: 'EUR', quote: 'HKD', contractSize: 100_000 });
  });

  it('accepts the no-slash form', () => {
    expect(getForexSpec('EURUSD')?.symbol).toBe('EUR/USD');
  });

  it('rejects an unparseable symbol', () => {
    expect(getForexSpec('NOTAPAIR')).toBeNull();
  });
});

describe('lot sizing', () => {
  it('scales a standard FX lot to mini, micro and nano', () => {
    expect(unitsPerLot(100_000, 'standard')).toBe(100_000);
    expect(unitsPerLot(100_000, 'mini')).toBe(10_000);
    expect(unitsPerLot(100_000, 'micro')).toBe(1_000);
    expect(unitsPerLot(100_000, 'nano')).toBe(100);
  });

  // The same multipliers must work for a non-100k instrument: a mini gold lot
  // is 10 oz, not 10,000 of anything.
  it('scales a gold contract with the same multipliers', () => {
    expect(unitsPerLot(100, 'standard')).toBe(100);
    expect(unitsPerLot(100, 'mini')).toBeCloseTo(10, 10);
    expect(unitsPerLot(100, 'micro')).toBeCloseTo(1, 10);
  });

  it('keeps the multiplier table ordered largest to smallest', () => {
    expect(LOT_MULTIPLIERS.standard).toBeGreaterThan(LOT_MULTIPLIERS.mini);
    expect(LOT_MULTIPLIERS.mini).toBeGreaterThan(LOT_MULTIPLIERS.micro);
    expect(LOT_MULTIPLIERS.micro).toBeGreaterThan(LOT_MULTIPLIERS.nano);
  });
});

describe('pip value against textbook figures', () => {
  it('is $10 per pip on one standard lot of a USD-quoted pair', () => {
    const spec = getForexSpec('EUR/USD')!;
    const value = calculateForexPipValue(spec.pipSize, unitsPerLot(spec.contractSize, 'standard'), 1);

    expect(value).toBe(10);
  });

  it('is $1 per pip on one micro lot', () => {
    const spec = getForexSpec('EUR/USD')!;
    const value = calculateForexPipValue(spec.pipSize, unitsPerLot(spec.contractSize, 'micro'), 1);

    expect(value).toBe(0.1);
  });

  // 0.01 pip x 100,000 yen = 1,000 JPY per pip, converted at ~150 JPY/USD.
  it('converts a JPY-quoted pip into the account currency', () => {
    const spec = getForexSpec('USD/JPY')!;
    const value = calculateForexPipValue(
      spec.pipSize,
      unitsPerLot(spec.contractSize, 'standard'),
      1 / 150,
    );

    expect(value).toBeCloseTo(6.67, 2);
  });

  // 0.01 x 100 oz = $1 per pip. Under the old 100k/0.0001 spec this came out at
  // $10 — a 10x error on every gold trade.
  it('is $1 per pip on one standard lot of gold', () => {
    const spec = getForexSpec('XAU/USD')!;
    const value = calculateForexPipValue(spec.pipSize, unitsPerLot(spec.contractSize, 'standard'), 1);

    expect(value).toBe(1);
  });
});

describe('Indian instrument universe', () => {
  it('lists a dual-listed company once, not once per exchange', () => {
    const reliance = INDIAN_INSTRUMENTS.filter((i) => i.symbol === 'RELIANCE');

    expect(reliance).toHaveLength(1);
    expect(reliance[0]?.exchange).toBe('NSE');
    expect(reliance[0]?.alsoOn).toContain('BSE');
  });

  it('has no duplicate symbols anywhere in the union', () => {
    const symbols = INDIAN_INSTRUMENTS.map((i) => i.symbol);

    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('covers both exchanges', () => {
    const exchanges = new Set(INDIAN_INSTRUMENTS.map((i) => i.exchange));

    expect(exchanges).toContain('NSE');
    expect(exchanges).toContain('BSE');
  });

  it('carries a broad set of names', () => {
    expect(INDIAN_INSTRUMENTS.length).toBeGreaterThan(400);
  });

  it('gives cash-only names a lot size of 1', () => {
    const cashOnly = INDIAN_INSTRUMENTS.filter((i) => !i.hasFno);

    expect(cashOnly.length).toBeGreaterThan(0);
    expect(cashOnly.every((i) => i.lotSize === 1)).toBe(true);
  });

  it('denominates everything in INR', () => {
    expect(INDIAN_INSTRUMENTS.every((i) => i.currency === 'INR')).toBe(true);
  });
});

describe('Indian segments', () => {
  it('offers only derivatives for an index — there is no cash market', () => {
    expect(segmentsFor(getIndianSpec('NIFTY')!)).toEqual(['FUT', 'OPT']);
  });

  it('offers cash and derivatives for an F&O stock', () => {
    expect(segmentsFor(getIndianSpec('RELIANCE')!)).toEqual(['EQ', 'FUT', 'OPT']);
  });

  it('offers only cash for a stock with no derivatives contract', () => {
    const cashOnly = INDIAN_INSTRUMENTS.find((i) => !i.hasFno)!;

    expect(segmentsFor(cashOnly)).toEqual(['EQ']);
  });

  // Cash equity quantity means SHARES, so the multiplier must be 1 even for a
  // name whose futures lot is 500.
  it('uses a multiplier of 1 for cash equity even on an F&O name', () => {
    const reliance = getIndianSpec('RELIANCE')!;

    expect(lotSizeFor(reliance, 'EQ')).toBe(1);
    expect(lotSizeFor(reliance, 'FUT')).toBe(reliance.lotSize);
  });

  it('maps each segment to the right market', () => {
    expect(marketForSegment('INDEX')).toBe('Index');
    expect(marketForSegment('EQ')).toBe('Equity');
    expect(marketForSegment('FUT')).toBe('Futures');
    expect(marketForSegment('OPT')).toBe('Options');
  });
});
