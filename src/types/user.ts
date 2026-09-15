import type { ISODateTime, UUID } from './common';
import type { TradingMode } from './trade';

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: UUID;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  /**
   * @deprecated Superseded by `TradingAccount`. Kept in sync with the Forex
   * account for one release so legacy reads keep working; removed in Phase 2
   * once every page reads from `useTradingAccount(mode)`.
   */
  baseCurrency: string; // ISO 4217, e.g. 'USD', 'INR'
  /** @deprecated Superseded by `TradingAccount.startingCapital`. */
  startingCapital: number;
  createdAt: ISODateTime;

  /** Suspended accounts keep their data but cannot write (enforced in RLS). */
  isSuspended?: boolean;
  suspendedReason?: string;
  lastActiveAt?: ISODateTime;
}

/** Public-facing session user (never carries secrets). */
export type SessionUser = User;

/**
 * One funded account per trading mode. A trader's Forex and Indian books have
 * their own capital base and their own currency, so ROI, drawdown and every
 * money figure must be computed against the account the trade belongs to —
 * never against a single account-wide number.
 *
 * The Indian account is always INR; that is enforced by a CHECK constraint in
 * the database, not just here.
 */
export interface TradingAccount {
  id: UUID;
  userId: UUID;
  tradingMode: TradingMode;
  currency: string; // ISO 4217 — always 'INR' when tradingMode === 'indian'
  startingCapital: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TradingAccountPatch = Partial<Pick<TradingAccount, 'currency' | 'startingCapital'>>;

export interface UserGoal {
  id: UUID;
  userId: UUID;
  type: 'net_pnl' | 'win_rate' | 'avg_r' | 'max_drawdown' | 'trades';
  targetValue: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  createdAt: ISODateTime;
}
