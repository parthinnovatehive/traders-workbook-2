import { describe, expect, it } from 'vitest';
import { buildEquityCurve, maxDrawdown, maxDrawdownPct } from '../drawdown';

describe('buildEquityCurve', () => {
  it('starts at the starting-capital baseline', () => {
    const curve = buildEquityCurve([], 1000);
    expect(curve).toHaveLength(1);
    expect(curve[0]).toMatchObject({ index: 0, equity: 1000, drawdown: 0 });
  });

  it('folds P&Ls into running equity with drawdown', () => {
    const curve = buildEquityCurve([100, -300, 50], 1000);
    expect(curve.map((p) => p.equity)).toEqual([1000, 1100, 800, 850]);
    expect(curve.map((p) => p.drawdown)).toEqual([0, 0, 300, 250]);
  });
});

describe('maxDrawdown', () => {
  it('is zero when the curve only makes new highs', () => {
    expect(maxDrawdown([100, 100, 100], 1000)).toBe(0);
  });

  it('captures the largest peak-to-trough decline', () => {
    expect(maxDrawdown([100, -300, 50], 1000)).toBe(300);
  });

  it('is zero for no trades', () => {
    expect(maxDrawdown([], 1000)).toBe(0);
  });
});

describe('maxDrawdownPct', () => {
  it('is the decline relative to the running peak', () => {
    // peak 1100, trough 800 => 300/1100 = 27.27%
    expect(maxDrawdownPct([100, -300, 50], 1000)).toBe(27.27);
  });

  it('null when starting capital is not positive', () => {
    expect(maxDrawdownPct([100], 0)).toBeNull();
  });
});
