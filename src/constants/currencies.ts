/** Supported account/base currencies (not restricted to USD & INR). */
export const ACCOUNT_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'AUD',
  'CAD',
  'CHF',
  'JPY',
  'NZD',
  'SGD',
] as const;

export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

/** Currency symbols for compact display where Intl is not used. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AED: 'د.إ',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  JPY: '¥',
  NZD: 'NZ$',
  SGD: 'S$',
};

export const currencySymbol = (code: string): string => CURRENCY_SYMBOLS[code] ?? code;
