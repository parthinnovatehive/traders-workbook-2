/**
 * Forex / CFD instrument specification layer.
 *
 * The curated universe lives in `data/forexPairs.json` — the same file that
 * generates the `instruments` table seed, so the app, the tests and the database
 * cannot drift apart. `getForexSpec` returns a curated spec when the symbol is
 * known and otherwise derives one by parsing the pair, so ANY pair a broker
 * offers still works.
 */
import raw from './data/forexPairs.json';

export type ForexCategory = 'major' | 'minor' | 'exotic' | 'metal' | 'crypto';

export interface ForexSpec {
  symbol: string; // 'EUR/USD'
  name: string;
  base: string; // 'EUR'
  quote: string; // 'USD'
  pipSize: number; // price increment of one pip (0.0001, or 0.01 for JPY quote)
  /** Units in ONE STANDARD lot. 100,000 for FX; 100 oz for gold; 1 for crypto. */
  contractSize: number;
  tickSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  category: ForexCategory;
}

export const LOT_TYPES = ['standard', 'mini', 'micro', 'nano'] as const;
export type LotType = (typeof LOT_TYPES)[number];

/**
 * How each lot type scales the instrument's contract size.
 *
 * This is what makes non-FX instruments correct: a standard FX lot is 100,000
 * units and a mini is 10,000 (×0.1), while a standard gold lot is 100 oz and a
 * mini is 10 oz (×0.1). One multiplier table, every instrument.
 */
export const LOT_MULTIPLIERS: Record<LotType, number> = {
  standard: 1,
  mini: 0.1,
  micro: 0.01,
  nano: 0.001,
};

/** Units per lot for a given instrument and lot type. */
export function unitsPerLot(contractSize: number, lotType: LotType): number {
  return contractSize * (LOT_MULTIPLIERS[lotType] ?? 1);
}

/** Units per 1 lot of each type for a standard 100k FX contract. */
export const LOT_UNITS: Record<LotType, number> = {
  standard: 100_000,
  mini: 10_000,
  micro: 1_000,
  nano: 100,
};

/** Human label for a lot type, scaled to the instrument actually selected. */
export function lotTypeLabel(lotType: LotType, contractSize = 100_000): string {
  const units = unitsPerLot(contractSize, lotType);
  const pretty =
    units >= 1000 ? `${(units / 1000).toLocaleString()}k` : units.toLocaleString();
  const name = lotType.charAt(0).toUpperCase() + lotType.slice(1);
  return `${name} (${pretty})`;
}

export const LOT_TYPE_LABELS: Record<LotType, string> = {
  standard: 'Standard (100k)',
  mini: 'Mini (10k)',
  micro: 'Micro (1k)',
  nano: 'Nano (100)',
};

interface RawPair {
  symbol: string;
  name?: string;
  category: string;
  contractSize?: number;
  pipSize?: number;
  tickSize?: number;
}

const RAW_PAIRS = raw.pairs as RawPair[];

const DEFAULT_LOT = { minLot: 0.01, maxLot: 100, lotStep: 0.01 };
const FX_CONTRACT_SIZE = 100_000;

/** Currencies used to build/parse pairs. */
export const FOREX_CURRENCIES = [
  'EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD',
  'SGD', 'HKD', 'INR', 'ZAR', 'MXN', 'TRY', 'NOK', 'SEK',
  'DKK', 'PLN', 'CZK', 'HUF', 'THB', 'CNH', 'KRW', 'AED',
  'SAR', 'ILS', 'BRL', 'PHP', 'TWD',
] as const;

const MAJORS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD']);

/** Every curated symbol, in display order. */
export const FOREX_PAIRS: string[] = RAW_PAIRS.map((p) => p.symbol);

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

/** The pip size convention for a pair with no explicit override. */
export function defaultPipSize(quote: string): number {
  return quote === 'JPY' ? 0.01 : 0.0001;
}

function toSpec(p: RawPair): ForexSpec | null {
  const parsed = parsePair(p.symbol);
  if (!parsed) return null;
  const { base, quote } = parsed;
  const pipSize = p.pipSize ?? defaultPipSize(quote);
  return {
    symbol: `${base}/${quote}`,
    name: p.name ?? `${base} / ${quote}`,
    base,
    quote,
    pipSize,
    contractSize: p.contractSize ?? FX_CONTRACT_SIZE,
    tickSize: p.tickSize ?? pipSize / 10,
    category: (p.category as ForexCategory) ?? categoryFor(base, quote),
    ...DEFAULT_LOT,
  };
}

/** Curated specs, keyed by normalised symbol. */
export const FOREX_SPECS: ForexSpec[] = RAW_PAIRS.map(toSpec).filter(
  (s): s is ForexSpec => s !== null,
);

const SPEC_BY_SYMBOL = new Map(FOREX_SPECS.map((s) => [s.symbol, s]));

/**
 * Get (or derive) the spec for any forex pair.
 *
 * A curated spec always wins — that is what makes XAU/USD a 100-ounce contract
 * with a 0.01 pip instead of being treated as a 100,000-unit currency pair,
 * which would overstate gold P&L by a factor of 1,000.
 */
export function getForexSpec(symbol: string): ForexSpec | null {
  const parsed = parsePair(symbol);
  if (!parsed) return null;
  const { base, quote } = parsed;
  const key = `${base}/${quote}`;

  const curated = SPEC_BY_SYMBOL.get(key);
  if (curated) return curated;

  const pipSize = defaultPipSize(quote);
  return {
    symbol: key,
    name: `${base} / ${quote}`,
    base,
    quote,
    pipSize,
    contractSize: FX_CONTRACT_SIZE,
    tickSize: pipSize / 10,
    category: categoryFor(base, quote),
    ...DEFAULT_LOT,
  };
}
