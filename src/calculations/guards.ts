import { isFiniteNumber } from '@/utils/money';

/** A price must be a finite, strictly positive number. */
export function isValidPrice(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/** A position size must be a finite, strictly positive number. */
export function isValidQuantity(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/** Charges must be a finite, non-negative number. */
export function isValidCharges(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/** A trade is closed once it has a valid exit price. */
export function isClosed(exitPrice: number | null | undefined): exitPrice is number {
  return isValidPrice(exitPrice);
}
