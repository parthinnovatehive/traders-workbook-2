import { describe, expect, it } from 'vitest';
import { computeTradeMetrics, tradeStatus } from '../trade-metrics';
import { calcInput } from './factory';

describe('tradeStatus', () => {
  it('open until a valid exit price exists', () => {
    expect(tradeStatus({ exitPrice: null })).toBe('open');
    expect(tradeStatus({ exitPrice: 110 })).toBe('closed');
  });
});

describe('computeTradeMetrics', () => {
  it('composes all metrics for a closed winning trade', () => {
    const m = computeTradeMetrics(calcInput());
    expect(m).toMatchObject({
      status: 'closed',
      grossPnl: 100,
      netPnl: 100,
      outcome: 'win',
      risk: 50,
      reward: 200,
      riskReward: 4,
      rMultiple: 2,
      roi: null, // no starting capital provided
    });
  });

  it('includes ROI when starting capital is provided', () => {
    const m = computeTradeMetrics(calcInput(), { startingCapital: 1000 });
    expect(m.roi).toBe(10);
  });

  it('open trade: P&L is N/A but planned risk/reward remain', () => {
    const m = computeTradeMetrics(calcInput({ exitPrice: null }));
    expect(m.status).toBe('open');
    expect(m.grossPnl).toBeNull();
    expect(m.netPnl).toBeNull();
    expect(m.outcome).toBeNull();
    expect(m.rMultiple).toBeNull();
    expect(m.risk).toBe(50);
    expect(m.reward).toBe(200);
    expect(m.riskReward).toBe(4);
  });

  it('missing stop: risk-based metrics are N/A', () => {
    const m = computeTradeMetrics(calcInput({ stopLoss: null }));
    expect(m.risk).toBeNull();
    expect(m.riskReward).toBeNull();
    expect(m.rMultiple).toBeNull();
    expect(m.reward).toBe(200); // target still present
    expect(m.netPnl).toBe(100); // P&L unaffected
  });
});
