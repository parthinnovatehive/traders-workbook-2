import { describe, expect, it } from 'vitest';
import type { Trade } from '@/types';
import { openPositions } from '../positions';
import { makeTrade } from './factory';

/**
 * Open positions: what the journal can honestly say about a trade that has not
 * been closed. No unrealized P&L — there is no price feed, and inventing one
 * would put the only made-up number on the dashboard.
 */

const open = (over: Partial<Trade> = {}): Trade =>
  makeTrade({ exitPrice: null, exitDate: undefined, ...over });

describe('openPositions', () => {
  it('excludes closed trades', () => {
    const summary = openPositions(
      [makeTrade({ exitPrice: 1.105 }), open({ id: 'a' })],
      '2026-01-10',
    );

    expect(summary.count).toBe(1);
    expect(summary.positions[0]?.trade.id).toBe('a');
  });

  it('is empty when nothing is open', () => {
    const summary = openPositions([makeTrade({ exitPrice: 1.2 })], '2026-01-10');

    expect(summary).toMatchObject({ count: 0, totalExposure: 0, totalRiskAtStop: 0 });
    expect(summary.positions).toEqual([]);
  });

  it('computes exposure from entry price, quantity and lot size', () => {
    const summary = openPositions(
      [open({ entryPrice: 100, quantity: 2, lotSize: 50, conversionRate: 1 })],
      '2026-01-10',
    );

    // 100 × 2 × 50
    expect(summary.positions[0]?.exposure).toBe(10_000);
    expect(summary.positions[0]?.positionSize).toBe(100);
  });

  it('converts exposure into the account currency', () => {
    const summary = openPositions(
      [open({ entryPrice: 100, quantity: 1, lotSize: 1, conversionRate: 80 })],
      '2026-01-10',
    );

    expect(summary.positions[0]?.exposure).toBe(8000);
  });

  it('reports the loss a stop would take', () => {
    const summary = openPositions(
      [open({ entryPrice: 100, stopLoss: 95, quantity: 2, lotSize: 10, conversionRate: 1 })],
      '2026-01-10',
    );

    // |100 - 95| × 2 × 10
    expect(summary.positions[0]?.riskAtStop).toBe(100);
    expect(summary.totalRiskAtStop).toBe(100);
  });

  it('flags a position with no stop instead of assuming zero risk', () => {
    const summary = openPositions([open({ stopLoss: null })], '2026-01-10');

    expect(summary.positions[0]?.riskAtStop).toBeNull();
    expect(summary.unprotected).toBe(1);
  });

  it('excludes unknown risks from the total rather than counting them as zero', () => {
    const summary = openPositions(
      [
        open({ id: 'a', entryPrice: 100, stopLoss: 90, quantity: 1, lotSize: 1, conversionRate: 1 }),
        open({ id: 'b', stopLoss: null }),
      ],
      '2026-01-10',
    );

    expect(summary.totalRiskAtStop).toBe(10);
    expect(summary.count).toBe(2);
    expect(summary.unprotected).toBe(1);
  });

  it('counts days held from the entry date', () => {
    const summary = openPositions([open({ entryDate: '2026-01-01' })], '2026-01-10');

    expect(summary.positions[0]?.daysOpen).toBe(9);
  });

  it('shows a position opened today as zero days, never negative', () => {
    const summary = openPositions([open({ entryDate: '2026-01-10' })], '2026-01-10');

    expect(summary.positions[0]?.daysOpen).toBe(0);
  });

  it('orders the newest position first', () => {
    const summary = openPositions(
      [
        open({ id: 'old', entryDate: '2026-01-01' }),
        open({ id: 'new', entryDate: '2026-01-08' }),
      ],
      '2026-01-10',
    );

    expect(summary.positions.map((p) => p.trade.id)).toEqual(['new', 'old']);
  });

  it('gives a planned R:R only when both a stop and a target exist', () => {
    const withTarget = openPositions(
      [open({ entryPrice: 100, stopLoss: 90, target: 130 })],
      '2026-01-10',
    );
    const withoutTarget = openPositions(
      [open({ entryPrice: 100, stopLoss: 90, target: null })],
      '2026-01-10',
    );

    expect(withTarget.positions[0]?.plannedRr).toBe(3);
    expect(withoutTarget.positions[0]?.plannedRr).toBeNull();
  });
});
