import { describe, expect, it } from 'vitest';
import { formatCompactCurrency, formatCompactSignedCurrency } from '../format';

/**
 * Large values used to overflow their cards on the Reports page. These lock in
 * the shortening rules, including the Indian lakh/crore system — an Indian
 * trader reads "₹1.2 Cr", not "₹12.0M".
 */

describe('compact currency — Indian numbering', () => {
  it('shortens to lakh above 1,00,000', () => {
    expect(formatCompactCurrency(125_000, 'INR')).toBe('₹1.3 L');
    expect(formatCompactCurrency(500_000, 'INR')).toBe('₹5 L');
  });

  it('shortens to crore above 1,00,00,000', () => {
    expect(formatCompactCurrency(3_40_00_000, 'INR')).toBe('₹3.4 Cr');
    expect(formatCompactCurrency(12_00_00_000, 'INR')).toBe('₹12 Cr');
  });

  it('never uses millions or billions for rupees', () => {
    expect(formatCompactCurrency(50_000_000, 'INR')).not.toMatch(/[MB]/);
  });

  it('keeps values below a lakh exact', () => {
    expect(formatCompactCurrency(45_250.5, 'INR')).toContain('45,250.50');
  });

  it('signs negatives', () => {
    expect(formatCompactCurrency(-250_000, 'INR')).toBe('-₹2.5 L');
  });
});

describe('compact currency — Western numbering', () => {
  it('shortens thousands, millions and billions', () => {
    expect(formatCompactCurrency(12_500, 'USD')).toBe('$12.5K');
    expect(formatCompactCurrency(1_200_000, 'USD')).toBe('$1.2M');
    expect(formatCompactCurrency(3_400_000_000, 'USD')).toBe('$3.4B');
  });

  it('keeps values below a thousand exact', () => {
    expect(formatCompactCurrency(842.75, 'USD')).toBe('$842.75');
  });

  it('drops a trailing .0', () => {
    expect(formatCompactCurrency(5_000, 'USD')).toBe('$5K');
  });

  it('drops the decimal entirely once three digits remain', () => {
    expect(formatCompactCurrency(125_000, 'USD')).toBe('$125K');
  });

  it('uses the right symbol per currency', () => {
    expect(formatCompactCurrency(12_500, 'GBP')).toBe('£12.5K');
    expect(formatCompactCurrency(12_500, 'EUR')).toBe('€12.5K');
  });

  it('signs negatives', () => {
    expect(formatCompactCurrency(-1_500_000, 'USD')).toBe('-$1.5M');
  });
});

describe('compact signed currency', () => {
  it('prefixes a plus for gains', () => {
    expect(formatCompactSignedCurrency(12_500, 'USD')).toBe('+$12.5K');
    expect(formatCompactSignedCurrency(250_000, 'INR')).toBe('+₹2.5 L');
  });

  it('leaves losses with their minus sign only', () => {
    expect(formatCompactSignedCurrency(-12_500, 'USD')).toBe('-$12.5K');
  });

  it('renders zero without a sign', () => {
    expect(formatCompactSignedCurrency(0, 'USD')).toBe('$0.00');
  });
});

describe('missing values', () => {
  it('renders N/A rather than a fake zero', () => {
    expect(formatCompactCurrency(null, 'INR')).toBe('N/A');
    expect(formatCompactCurrency(undefined, 'USD')).toBe('N/A');
    expect(formatCompactCurrency(Number.NaN, 'USD')).toBe('N/A');
    expect(formatCompactSignedCurrency(null, 'USD')).toBe('N/A');
  });
});
