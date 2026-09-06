import { describe, expect, it } from 'vitest';
import { expectancy, expectancyFromPnls } from '../expectancy';

describe('expectancy (primitive)', () => {
  it('(winRate*avgWin) - (lossRate*avgLoss)', () => {
    expect(expectancy(0.6, 200, 0.4, 100)).toBe(80);
  });

  it('treats averageLoss as a positive magnitude', () => {
    expect(expectancy(0.5, 100, 0.5, -100)).toBe(0);
  });
});

describe('expectancyFromPnls', () => {
  it('positive expectancy', () => {
    // wins [100,100], loss [-50] => (2/3*100) - (1/3*50) = 50
    expect(expectancyFromPnls([100, 100, -50])).toBe(50);
  });

  it('negative expectancy', () => {
    // win [50], losses [-100,-100] => (1/3*50) - (2/3*100) = -50
    expect(expectancyFromPnls([50, -100, -100])).toBe(-50);
  });

  it('all wins', () => {
    expect(expectancyFromPnls([100, 100])).toBe(100);
  });

  it('all losses', () => {
    expect(expectancyFromPnls([-100, -50])).toBe(-75);
  });

  it('null with no trades', () => {
    expect(expectancyFromPnls([])).toBeNull();
  });
});
