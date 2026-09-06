/**
 * The calculation engine — the single source of truth for all financial math.
 * Pure functions only: no React, no I/O, no Date.now(). Every value that cannot
 * be computed from the given inputs returns `null` (rendered as "N/A"); nothing
 * is ever invented.
 */
export * from './guards';
export * from './units';
export * from './forex';
export * from './pnl';
export * from './risk';
export * from './rmultiple';
export * from './roi';
export * from './drawdown';
export * from './expectancy';
export * from './performance';
export * from './trade-metrics';
export * from './strategy';
export * from './series';
export * from './analytics';
export * from './rankings';
export * from './insights';
