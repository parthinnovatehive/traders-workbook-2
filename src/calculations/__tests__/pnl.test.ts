import { describe, expect, it } from 'vitest';
import { grossPnl, netPnl, tradeOutcome } from '../pnl';
import { calcInput } from './factory';

describe('grossPnl', () => {
  it('long profit', () => {
    expect(grossPnl(calcInput({ entryPrice: 100, exitPrice: 110, quantity: 10 }))).toBe(100);
  });

  it('long loss', () => {
    expect(grossPnl(calcInput({ entryPrice: 100, exitPrice: 90, quantity: 10 }))).toBe(-100);
  });

  it('short profit', () => {
    expect(
      grossPnl(calcInput({ direction: 'short', entryPrice: 100, exitPrice: 90, quantity: 10 })),
    ).toBe(100);
  });

  it('short loss', () => {
    expect(
      grossPnl(calcInput({ direction: 'short', entryPrice: 100, exitPrice: 110, quantity: 10 })),
    ).toBe(-100);
  });

  it('returns null for an open trade (no exit price)', () => {
    expect(grossPnl(calcInput({ exitPrice: null }))).toBeNull();
  });

  it('returns null for invalid entry price or quantity', () => {
    expect(grossPnl(calcInput({ entryPrice: 0 }))).toBeNull();
    expect(grossPnl(calcInput({ quantity: 0 }))).toBeNull();
    expect(grossPnl(calcInput({ quantity: -5 }))).toBeNull();
  });
});

describe('netPnl', () => {
  it('subtracts charges from gross', () => {
    expect(netPnl(calcInput({ entryPrice: 100, exitPrice: 110, quantity: 10, charges: 20 }))).toBe(
      80,
    );
  });

  it('treats missing/negative charges as zero', () => {
    expect(netPnl(calcInput({ entryPrice: 100, exitPrice: 110, quantity: 10, charges: -5 }))).toBe(
      100,
    );
  });

  it('is null for an open trade', () => {
    expect(netPnl(calcInput({ exitPrice: null }))).toBeNull();
  });
});

describe('tradeOutcome', () => {
  it('classifies win / loss / breakeven', () => {
    expect(tradeOutcome(100)).toBe('win');
    expect(tradeOutcome(-100)).toBe('loss');
    expect(tradeOutcome(0)).toBe('breakeven');
  });

  it('is null when net P&L is null', () => {
    expect(tradeOutcome(null)).toBeNull();
  });

  it('charges can turn a flat trade into a loss', () => {
    const net = netPnl(calcInput({ entryPrice: 100, exitPrice: 100, quantity: 10, charges: 5 }));
    expect(net).toBe(-5);
    expect(tradeOutcome(net)).toBe('loss');
  });
});
