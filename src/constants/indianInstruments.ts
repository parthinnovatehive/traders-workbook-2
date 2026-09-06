/**
 * Indian market instrument specification layer.
 *
 * Structure: Instrument → Exchange → Segment → Lot Size.
 * Lot sizes are EXCHANGE-DEFINED and change over time, so they are configurable
 * defaults here — verify against the exchange before relying on them. The
 * calculation engine reads the lot size from the spec, so updating a value here
 * never requires touching the engine. All Indian instruments settle in INR.
 */

export type IndianExchange = 'NSE' | 'BSE';
export type IndianSegment = 'INDEX' | 'FUT' | 'OPT' | 'EQ';

export interface IndianSpec {
  symbol: string;
  name: string;
  exchange: IndianExchange;
  segment: IndianSegment;
  lotSize: number; // contract multiplier (1 for cash equity)
  tickSize: number;
  currency: 'INR';
}

/**
 * Configurable defaults. NOTE: index/F&O lot sizes are revised periodically by
 * the exchange — treat these as editable configuration, not fixed market data.
 */
export const INDIAN_INSTRUMENTS: IndianSpec[] = [
  { symbol: 'NIFTY', name: 'Nifty 50', exchange: 'NSE', segment: 'INDEX', lotSize: 75, tickSize: 0.05, currency: 'INR' },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty', exchange: 'NSE', segment: 'INDEX', lotSize: 35, tickSize: 0.05, currency: 'INR' },
  { symbol: 'FINNIFTY', name: 'Fin Nifty', exchange: 'NSE', segment: 'INDEX', lotSize: 65, tickSize: 0.05, currency: 'INR' },
  { symbol: 'MIDCPNIFTY', name: 'Midcap Nifty', exchange: 'NSE', segment: 'INDEX', lotSize: 140, tickSize: 0.05, currency: 'INR' },
  { symbol: 'SENSEX', name: 'Sensex', exchange: 'BSE', segment: 'INDEX', lotSize: 20, tickSize: 0.05, currency: 'INR' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', segment: 'FUT', lotSize: 500, tickSize: 0.05, currency: 'INR' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', segment: 'FUT', lotSize: 550, tickSize: 0.05, currency: 'INR' },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE', segment: 'FUT', lotSize: 400, tickSize: 0.05, currency: 'INR' },
  { symbol: 'TCS', name: 'Tata Consultancy', exchange: 'NSE', segment: 'FUT', lotSize: 175, tickSize: 0.05, currency: 'INR' },
  { symbol: 'TATASTEEL', name: 'Tata Steel', exchange: 'NSE', segment: 'EQ', lotSize: 1, tickSize: 0.05, currency: 'INR' },
  { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE', segment: 'EQ', lotSize: 1, tickSize: 0.05, currency: 'INR' },
];

export const INDIAN_SEGMENTS: IndianSegment[] = ['INDEX', 'FUT', 'OPT', 'EQ'];
export const INDIAN_EXCHANGES: IndianExchange[] = ['NSE', 'BSE'];

export function getIndianSpec(symbol: string): IndianSpec | null {
  const upper = symbol.toUpperCase();
  return INDIAN_INSTRUMENTS.find((i) => i.symbol === upper) ?? null;
}
