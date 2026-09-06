/**
 * FX rate provider.
 *
 * IMPORTANT: these are MOCK/development rates, not live market data. The app
 * never pretends to have real-time FX prices. A production integration should
 * implement `FxRateProvider` against a real market-data source and swap it in
 * via `setFxProvider`. Rates captured at trade-entry time are stored on the
 * trade (`conversionRate`) so the pure calculation engine stays deterministic.
 */

export interface FxRateProvider {
  /** Multiplier to convert 1 unit of `from` currency into `to` currency. */
  getRate(from: string, to: string): number;
  /** Whether these are live rates (false for the mock provider). */
  readonly isLive: boolean;
}

/** Units of each currency per 1 USD (mock reference table — configurable). */
export const MOCK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150,
  CHF: 0.88,
  AUD: 1.52,
  CAD: 1.36,
  NZD: 1.65,
  SGD: 1.34,
  HKD: 7.8,
  INR: 83,
  ZAR: 18.5,
  MXN: 17.1,
  TRY: 32,
  NOK: 10.6,
  SEK: 10.4,
  AED: 3.67,
};

export function createStaticFxProvider(perUsd: Record<string, number> = MOCK_USD_RATES): FxRateProvider {
  return {
    isLive: false,
    getRate(from: string, to: string): number {
      if (from === to) return 1;
      const f = perUsd[from];
      const t = perUsd[to];
      if (!f || !t) return 1; // unknown currency → no conversion (avoid inventing)
      return t / f;
    },
  };
}

let provider: FxRateProvider = createStaticFxProvider();

export const getFxProvider = (): FxRateProvider => provider;
export const setFxProvider = (p: FxRateProvider): void => {
  provider = p;
};

/** Convenience: convert an amount between currencies using the active provider. */
export function convertAmount(amount: number, from: string, to: string): number {
  return amount * provider.getRate(from, to);
}
