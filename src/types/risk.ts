import type { UUID } from './common';
import type { TradingMode } from './trade';

/**
 * A user's configurable risk rules (Section 16) — one row PER TRADING MODE.
 *
 * `dailyLossLimit` is an absolute amount in the owning account's currency, so it
 * only means something alongside the mode it belongs to: a ₹10,000 limit on the
 * Indian book and a $200 limit on the Forex book are different rules and must be
 * stored separately. A single global row made the same number render as ₹10,000
 * or $10,000 depending on which mode the user happened to be viewing.
 */
export interface RiskSetting {
  id: UUID;
  userId: UUID;
  tradingMode: TradingMode;
  riskPerTradePct: number; // % of capital risked per trade, e.g. 1 = 1%
  dailyLossLimit: number; // absolute amount in the mode's account currency (positive)
  maxDrawdownPct: number; // % peak-to-trough limit
  maxPositionPct: number; // max position value as % of capital
}

/** The editable fields — id/userId/tradingMode identify the row, never change. */
export type RiskSettingPatch = Partial<Omit<RiskSetting, 'id' | 'userId' | 'tradingMode'>>;

export const RISK_WARNING_CODES = [
  'RISK_PER_TRADE_EXCEEDED',
  'DAILY_LOSS_LIMIT_REACHED',
  'POSITION_SIZE_EXCEEDED',
  'MAX_DRAWDOWN_EXCEEDED',
] as const;
export type RiskWarningCode = (typeof RISK_WARNING_CODES)[number];

export type RiskWarningSeverity = 'info' | 'warning' | 'danger';

export interface RiskWarning {
  code: RiskWarningCode;
  severity: RiskWarningSeverity;
  message: string;
}
