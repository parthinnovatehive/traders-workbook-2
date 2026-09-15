import type { ISODateTime, UUID } from './common';
import type { TradingMode } from './trade';

/**
 * A tradeable instrument from the server-side master list.
 *
 * Contract specifications (lot size, tick size, pip size) are DATA, not code:
 * NSE/BSE revise F&O lot sizes several times a year, so they live in the
 * `instruments` table and are editable by an admin. The calculation engine reads
 * whatever the spec says, so a correction never requires a redeploy.
 */
export interface Instrument {
  id: string; // 'NSE:RELIANCE' | 'FX:EURUSD'
  tradingMode: TradingMode;
  symbol: string;
  name: string;

  // Indian
  exchange?: string; // 'NSE' | 'BSE'
  /** Other exchanges the same name trades on — so dual-listed stocks appear once. */
  alsoOn: string[];
  /** Base segment: 'INDEX' for indices, 'EQ' for stocks. */
  segment?: IndianSegment;
  /** True when a futures/options contract exists — unlocks FUT/OPT in the form. */
  hasFno: boolean;

  // Forex
  baseCurrency?: string;
  quoteCurrency?: string;

  /** Units in one contract (FX: 100,000 for a standard lot). */
  contractSize: number;
  /** Contract multiplier. 1 for cash equity, where quantity means SHARES. */
  lotSize: number;
  pipSize?: number;
  tickSize: number;

  category?: InstrumentCategory;
  isActive: boolean;
  sortOrder: number;
}

export const INDIAN_SEGMENT_VALUES = ['INDEX', 'FUT', 'OPT', 'EQ'] as const;
export type IndianSegment = (typeof INDIAN_SEGMENT_VALUES)[number];

export type InstrumentCategory =
  | 'major'
  | 'minor'
  | 'exotic'
  | 'metal'
  | 'crypto'
  | 'index'
  | 'fno'
  | 'cash';

/** Display grouping for the instrument picker, in render order. */
export const CATEGORY_LABELS: Record<InstrumentCategory, string> = {
  major: 'Majors',
  minor: 'Crosses',
  exotic: 'Exotics',
  metal: 'Metals',
  crypto: 'Crypto',
  index: 'Indices',
  fno: 'F&O',
  cash: 'Equity',
};

export const CATEGORY_ORDER: InstrumentCategory[] = [
  'major',
  'minor',
  'exotic',
  'metal',
  'crypto',
  'index',
  'fno',
  'cash',
];

/** A user's starred instrument. Favourites are per user AND per trading mode. */
export interface Favourite {
  userId: UUID;
  tradingMode: TradingMode;
  symbol: string;
  createdAt: ISODateTime;
}

/** True when `quantity` on a trade means shares rather than lots. */
export const isCashEquity = (instrument: Pick<Instrument, 'segment' | 'lotSize'>): boolean =>
  instrument.segment === 'EQ' || instrument.lotSize === 1;
