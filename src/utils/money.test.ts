import { describe, expect, it } from 'vitest';
import { isFiniteNumber, roundMoney, roundTo } from './money';

describe('roundTo', () => {
  it('rounds to 2 dp by default and fixes float error cases', () => {
    expect(roundTo(1.005)).toBe(1.01);
    expect(roundTo(2.675)).toBe(2.68);
    expect(roundTo(10.126)).toBe(10.13);
  });

  it('rounds negatives symmetrically (half away from zero)', () => {
    expect(roundTo(-1.005)).toBe(-1.01);
    expect(roundTo(-2.675)).toBe(-2.68);
  });

  it('supports custom decimal places', () => {
    expect(roundTo(3.14159, 3)).toBe(3.142);
    expect(roundTo(1234.5, 0)).toBe(1235);
  });

  it('normalizes -0 to 0', () => {
    expect(Object.is(roundTo(-0.0001), 0)).toBe(true);
  });

  it('passes through non-finite values unchanged', () => {
    expect(roundTo(Number.NaN)).toBeNaN();
    expect(roundTo(Infinity)).toBe(Infinity);
  });
});

describe('roundMoney', () => {
  it('rounds to the minor currency unit', () => {
    expect(roundMoney(10.126)).toBe(10.13);
    expect(roundMoney(-0.005)).toBe(-0.01);
  });
});

describe('isFiniteNumber', () => {
  it('accepts finite numbers only', () => {
    expect(isFiniteNumber(3)).toBe(true);
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber('3')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});
