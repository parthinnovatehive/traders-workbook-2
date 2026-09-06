import type { UUID } from './common';

/** A user's configurable risk rules (Section 16). */
export interface RiskSetting {
  id: UUID;
  userId: UUID;
  riskPerTradePct: number; // % of capital risked per trade, e.g. 1 = 1%
  dailyLossLimit: number; // absolute currency amount (positive)
  maxDrawdownPct: number; // % peak-to-trough limit
  maxPositionPct: number; // max position value as % of capital
}

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
