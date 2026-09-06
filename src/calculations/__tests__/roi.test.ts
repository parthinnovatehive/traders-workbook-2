import { describe, expect, it } from 'vitest';
import { roi } from '../roi';

describe('roi', () => {
  it('positive ROI', () => {
    expect(roi(100, 1000)).toBe(10);
  });

  it('negative ROI', () => {
    expect(roi(-50, 1000)).toBe(-5);
  });

  it('null net P&L => null', () => {
    expect(roi(null, 1000)).toBeNull();
  });

  it('non-positive starting capital => null', () => {
    expect(roi(100, 0)).toBeNull();
    expect(roi(100, -1000)).toBeNull();
  });
});
