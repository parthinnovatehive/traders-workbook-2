import { describe, expect, it } from 'vitest';
import { rMultiple } from '../rmultiple';
import { calcInput } from './factory';

describe('rMultiple', () => {
  it('positive R: net +100 on 50 risk = 2R', () => {
    // entry 100, exit 110, qty 10 => net 100; stop 95 => risk 50
    expect(rMultiple(calcInput({ entryPrice: 100, exitPrice: 110, quantity: 10, stopLoss: 95 }))).toBe(
      2,
    );
  });

  it('negative R: net -50 on 100 risk = -0.5R', () => {
    // entry 100, exit 95, qty 10 => net -50; stop 90 => risk 100
    expect(rMultiple(calcInput({ entryPrice: 100, exitPrice: 95, quantity: 10, stopLoss: 90 }))).toBe(
      -0.5,
    );
  });

  it('zero risk (stop == entry) => null', () => {
    expect(rMultiple(calcInput({ entryPrice: 100, stopLoss: 100 }))).toBeNull();
  });

  it('missing stop => null', () => {
    expect(rMultiple(calcInput({ stopLoss: null }))).toBeNull();
  });

  it('open trade => null', () => {
    expect(rMultiple(calcInput({ exitPrice: null }))).toBeNull();
  });
});
