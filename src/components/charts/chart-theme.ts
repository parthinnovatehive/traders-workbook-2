/** Chart colors resolve to the app's CSS theme tokens, so charts follow dark/light. */
export const CHART = {
  profit: 'var(--profit)',
  loss: 'var(--loss)',
  primary: 'var(--primary)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  muted: 'var(--muted)',
  grid: 'var(--border)',
} as const;

/** Categorical series palette for multi-series charts. */
export const SERIES_COLORS = [
  'var(--primary)',
  'var(--profit)',
  'var(--warning)',
  'var(--info)',
  'var(--loss)',
  '#a78bfa',
  '#f472b6',
  '#34d399',
];

export const tooltipContentStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 10px',
} as const;

export const tooltipItemStyle = { color: 'var(--text)' } as const;
export const tooltipLabelStyle = { color: 'var(--muted)', marginBottom: 4 } as const;

export const axisTick = { fill: 'var(--muted)', fontSize: 11 } as const;

/** Recharts tooltip/axis value type (matches ValueType | undefined). */
export type ChartValue = number | string | ReadonlyArray<number | string> | undefined;

/** Coerce a Recharts value to a number for formatting. */
export const asNum = (v: ChartValue): number => Number(Array.isArray(v) ? v[0] : v);
