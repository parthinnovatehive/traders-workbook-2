import { describe, expect, it } from 'vitest';
import { initialRisk, plannedReward, riskReward } from '../risk';
import { calcInput } from './factory';

describe('initialRisk', () => {
  it('computes |entry - stop| * qty with a valid stop', () => {
    expect(initialRisk(calcInput({ entryPrice: 100, stopLoss: 95, quantity: 10 }))).toBe(50);
  });

  it('scales with position size', () => {
    expect(initialRisk(calcInput({ entryPrice: 100, stopLoss: 95, quantity: 20 }))).toBe(100);
  });

  it('is direction-agnostic (absolute distance)', () => {
    expect(
      initialRisk(calcInput({ direction: 'short', entryPrice: 100, stopLoss: 105, quantity: 10 })),
    ).toBe(50);
  });

  it('returns null when the stop loss is missing', () => {
    expect(initialRisk(calcInput({ stopLoss: null }))).toBeNull();
  });

  it('returns null for invalid inputs', () => {
    expect(initialRisk(calcInput({ quantity: 0 }))).toBeNull();
    expect(initialRisk(calcInput({ entryPrice: 0 }))).toBeNull();
  });
});

describe('plannedReward', () => {
  it('computes |target - entry| * qty', () => {
    expect(plannedReward(calcInput({ entryPrice: 100, target: 120, quantity: 10 }))).toBe(200);
  });

  it('returns null when the target is missing', () => {
    expect(plannedReward(calcInput({ target: null }))).toBeNull();
  });
});

describe('riskReward', () => {
  it('is reward / risk', () => {
    expect(
      riskReward(calcInput({ entryPrice: 100, stopLoss: 95, target: 120, quantity: 10 })),
    ).toBe(4);
  });

  it('is null when stop or target is missing', () => {
    expect(riskReward(calcInput({ stopLoss: null }))).toBeNull();
    expect(riskReward(calcInput({ target: null }))).toBeNull();
  });

  it('is null when risk is zero (stop == entry)', () => {
    expect(riskReward(calcInput({ entryPrice: 100, stopLoss: 100, target: 120 }))).toBeNull();
  });
});
