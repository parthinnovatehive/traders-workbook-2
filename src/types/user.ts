import type { ISODateTime, UUID } from './common';

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: UUID;
  email: string;
  displayName: string;
  role: UserRole;
  baseCurrency: string; // ISO 4217, e.g. 'USD', 'INR'
  startingCapital: number;
  createdAt: ISODateTime;
}

/** Public-facing session user (never carries secrets). */
export type SessionUser = User;

export interface UserGoal {
  id: UUID;
  userId: UUID;
  type: 'net_pnl' | 'win_rate' | 'avg_r' | 'max_drawdown' | 'trades';
  targetValue: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  createdAt: ISODateTime;
}
