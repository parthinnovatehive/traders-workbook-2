import { describe, expect, it } from 'vitest';
import { computeAccountMetrics, winRate } from '../performance';
import { makeTrade } from './factory';

describe('winRate', () => {
  it('all wins => 100', () => {
    expect(winRate([10, 20])).toBe(100);
  });
  it('all losses => 0', () => {
    expect(winRate([-10, -5])).toBe(0);
  });
  it('mixed => proportion of wins', () => {
    expect(winRate([10, -10, 20, -5])).toBe(50);
  });
  it('breakevens are not wins', () => {
    expect(winRate([10, 0, -10])).toBe(33.33);
  });
  it('no closed trades => null', () => {
    expect(winRate([])).toBeNull();
  });
});

describe('computeAccountMetrics', () => {
  const trades = [
    makeTrade({ id: 'A', entryPrice: 100, exitPrice: 110, quantity: 10, stopLoss: 95, exitTime: '10:00' }),
    makeTrade({ id: 'B', entryPrice: 100, exitPrice: 90, quantity: 10, stopLoss: 95, exitTime: '11:00' }),
    makeTrade({
      id: 'C',
      direction: 'short',
      entryPrice: 100,
      exitPrice: 90,
      quantity: 10,
      stopLoss: 105,
      charges: 10,
      exitTime: '12:00',
    }),
    makeTrade({ id: 'D', exitPrice: null }), // open — excluded from realized metrics
  ];
  const m = computeAccountMetrics(trades, 1000);

  it('counts trades and open/closed split', () => {
    expect(m.totalTrades).toBe(4);
    expect(m.closedTrades).toBe(3);
    expect(m.openTrades).toBe(1);
  });

  it('win/loss/breakeven counts', () => {
    expect(m.winningTrades).toBe(2);
    expect(m.losingTrades).toBe(1);
    expect(m.breakevenTrades).toBe(0);
  });

  it('P&L totals and charges', () => {
    expect(m.grossPnl).toBe(100);
    expect(m.netPnl).toBe(90);
    expect(m.totalCharges).toBe(10);
  });

  it('rates and averages', () => {
    expect(m.winRate).toBe(66.67);
    expect(m.lossRate).toBe(33.33);
    expect(m.averageWin).toBe(95);
    expect(m.averageLoss).toBe(100);
    expect(m.averageR).toBe(0.6);
  });

  it('expectancy, profit factor, roi', () => {
    expect(m.expectancy).toBe(30);
    expect(m.profitFactor).toBe(1.9);
    expect(m.roi).toBe(9);
  });

  it('drawdown, best/worst, capital', () => {
    expect(m.maxDrawdown).toBe(100);
    expect(m.maxDrawdownPct).toBe(9.09);
    expect(m.bestTrade).toBe(100);
    expect(m.worstTrade).toBe(-100);
    expect(m.startingCapital).toBe(1000);
    expect(m.endingCapital).toBe(1090);
  });

  it('empty set yields null rates but zeroed counts', () => {
    const empty = computeAccountMetrics([], 1000);
    expect(empty.totalTrades).toBe(0);
    expect(empty.winRate).toBeNull();
    expect(empty.expectancy).toBeNull();
    expect(empty.maxDrawdown).toBe(0);
    expect(empty.endingCapital).toBe(1000);
  });
});
