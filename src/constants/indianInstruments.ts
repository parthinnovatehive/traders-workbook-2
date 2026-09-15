/**
 * Indian market instrument specification layer.
 *
 * The universe lives in `data/indianInstruments.json` — the NSE + BSE **union**,
 * one row per company. A dual-listed name like RELIANCE appears once, with the
 * other exchange recorded in `alsoOn`, rather than as separate NSE and BSE rows.
 *
 * Segments are derived, not stored per row: an index trades as FUT/OPT, a stock
 * with a derivatives contract trades as EQ/FUT/OPT, and every other stock is
 * cash-only. That is what lets one row serve all three.
 *
 * Lot sizes are EXCHANGE-DEFINED and revised several times a year, so they are
 * configurable defaults — the DB copy is admin-editable and the trade form lets
 * a user override the value per trade. The calculation engine reads whatever the
 * spec says, so a correction never requires touching the engine.
 */
import raw from './data/indianInstruments.json';

export type IndianExchange = 'NSE' | 'BSE';
export type IndianSegment = 'INDEX' | 'FUT' | 'OPT' | 'EQ';

export interface IndianSpec {
  symbol: string;
  name: string;
  exchange: IndianExchange;
  /** Other exchanges the same name is listed on. */
  alsoOn: IndianExchange[];
  /** Default segment: 'INDEX' for indices, 'EQ' for stocks. */
  segment: IndianSegment;
  /** True when a futures/options contract exists for this name. */
  hasFno: boolean;
  /** F&O contract multiplier. 1 for cash-only names (quantity = SHARES). */
  lotSize: number;
  tickSize: number;
  currency: 'INR';
}

interface RawIndex {
  symbol: string;
  name: string;
  exchange: string;
  lotSize: number;
}

interface RawStock {
  symbol: string;
  name: string;
  exchange?: string;
  alsoOn?: string[];
  hasFno: boolean;
  lotSize: number;
}

const TICK_SIZE = 0.05;

/** When the bundled lot sizes were last reconciled with an exchange circular. */
export const LOT_SIZES_AS_OF: string = raw._lotSizeAsOf;

const indices: IndianSpec[] = (raw.indices as RawIndex[]).map((i) => ({
  symbol: i.symbol,
  name: i.name,
  exchange: i.exchange as IndianExchange,
  alsoOn: [],
  segment: 'INDEX',
  hasFno: true, // indices are only tradeable as derivatives
  lotSize: i.lotSize,
  tickSize: TICK_SIZE,
  currency: 'INR',
}));

const stocks: IndianSpec[] = (raw.stocks as RawStock[]).map((s) => ({
  symbol: s.symbol,
  name: s.name,
  exchange: (s.exchange as IndianExchange) ?? 'NSE',
  alsoOn: (s.alsoOn ?? []) as IndianExchange[],
  segment: 'EQ',
  hasFno: s.hasFno,
  lotSize: s.hasFno ? s.lotSize : 1,
  tickSize: TICK_SIZE,
  currency: 'INR',
}));

/** Indices first, then stocks alphabetically — the order the picker renders. */
export const INDIAN_INSTRUMENTS: IndianSpec[] = [
  ...indices,
  ...stocks.toSorted((a, b) => a.symbol.localeCompare(b.symbol)),
];

export const INDIAN_SEGMENTS: IndianSegment[] = ['INDEX', 'FUT', 'OPT', 'EQ'];
export const INDIAN_EXCHANGES: IndianExchange[] = ['NSE', 'BSE'];

const BY_SYMBOL = new Map(INDIAN_INSTRUMENTS.map((i) => [i.symbol, i]));

export function getIndianSpec(symbol: string): IndianSpec | null {
  return BY_SYMBOL.get(symbol.toUpperCase()) ?? null;
}

/**
 * The segments a user may actually trade this instrument in.
 * Indices have no cash market; stocks without a derivatives contract have only
 * a cash market. Offering an impossible segment is how wrong lot sizes get in.
 */
export function segmentsFor(spec: Pick<IndianSpec, 'segment' | 'hasFno'>): IndianSegment[] {
  if (spec.segment === 'INDEX') return ['FUT', 'OPT'];
  return spec.hasFno ? ['EQ', 'FUT', 'OPT'] : ['EQ'];
}

/**
 * The contract multiplier for a given segment.
 * Cash equity is always 1 — there, `quantity` means SHARES, not lots.
 */
export function lotSizeFor(spec: Pick<IndianSpec, 'lotSize'>, segment: IndianSegment): number {
  return segment === 'EQ' ? 1 : spec.lotSize;
}

/** The `Market` value a segment maps to, for the trade record. */
export function marketForSegment(segment: IndianSegment): 'Index' | 'Equity' | 'Futures' | 'Options' {
  switch (segment) {
    case 'INDEX':
      return 'Index';
    case 'EQ':
      return 'Equity';
    case 'OPT':
      return 'Options';
    case 'FUT':
    default:
      return 'Futures';
  }
}
