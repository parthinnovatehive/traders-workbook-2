/**
 * Forex instrument specification layer.
 *
 * Specs are configurable — do not assume all brokers use identical contract
 * specifications. `getForexSpec` returns a curated spec when known, otherwise
 * derives a sensible one by parsing the pair, so ANY pair is supported (not just
 * a hardcoded few).
 */

export type ForexCategory = 'major' | 'minor' | 'exotic';

export interface ForexSpec {
  symbol: string; // 'EUR/USD'
  base: string; // 'EUR'
  quote: string; // 'USD'
  pipSize: number; // price increment of one pip (0.0001, or 0.01 for JPY quote)
  contractSize: number; // units in one standard lot
  tickSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  category: ForexCategory;
}

export const LOT_TYPES = ['standard', 'mini', 'micro', 'nano'] as const;
export type LotType = (typeof LOT_TYPES)[number];

/** Units per 1 lot of each type. */
export const LOT_UNITS: Record<LotType, number> = {
  standard: 100_000,
  mini: 10_000,
  micro: 1_000,
  nano: 100,
};

export const LOT_TYPE_LABELS: Record<LotType, string> = {
  standard: 'Standard (100k)',
  mini: 'Mini (10k)',
  micro: 'Micro (1k)',
  nano: 'Nano (100)',
};

/** Currencies used to build/parse pairs. */
export const FOREX_CURRENCIES = [
  'EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD',
  'SGD', 'HKD', 'INR', 'ZAR', 'MXN', 'TRY', 'NOK', 'SEK',
] as const;

const MAJORS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD']);

/** Curated pairs shown by default (users can still search/select any pair). */
export const FOREX_PAIRS: string[] = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'CHF/JPY', 'EUR/AUD',
  'GBP/CHF', 'AUD/NZD', 'EUR/CAD', 'GBP/AUD', 'CAD/JPY', 'NZD/JPY',
  'USD/INR', 'USD/SGD', 'USD/ZAR', 'USD/MXN', 'USD/TRY', 'USD/HKD', 'EUR/TRY',
];

const DEFAULT_LOT = { minLot: 0.01, maxLot: 100, lotStep: 0.01 };

function categoryFor(base: string, quote: string): ForexCategory {
  const key = `${base}/${quote}`;
  if (MAJORS.has(key)) return 'major';
  const g10 = new Set(['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD']);
  return g10.has(base) && g10.has(quote) ? 'minor' : 'exotic';
}

/** Parse a pair symbol into base/quote (accepts 'EUR/USD' or 'EURUSD'). */
export function parsePair(symbol: string): { base: string; quote: string } | null {
  const cleaned = symbol.toUpperCase().replace(/\s/g, '');
  if (cleaned.includes('/')) {
    const [base, quote] = cleaned.split('/');
    if (base && quote) return { base, quote };
    return null;
  }
  if (cleaned.length === 6) {
    return { base: cleaned.slice(0, 3), quote: cleaned.slice(3) };
  }
  return null;
}

/** Get (or derive) the spec for any forex pair. */
export function getForexSpec(symbol: string): ForexSpec | null {
  const parsed = parsePair(symbol);
  if (!parsed) return null;
  const { base, quote } = parsed;
  const pipSize = quote === 'JPY' ? 0.01 : 0.0001;
  return {
    symbol: `${base}/${quote}`,
    base,
    quote,
    pipSize,
    contractSize: LOT_UNITS.standard,
    tickSize: pipSize / 10,
    category: categoryFor(base, quote),
    ...DEFAULT_LOT,
  };
}
