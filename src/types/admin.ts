import type { ISODate, ISODateTime, UUID } from './common';

/**
 * Admin-facing shapes.
 *
 * Note what is NOT here: no trade, no P&L, no position. An admin manages the
 * platform and never reads a user's book — the server enforces this too, via
 * SECURITY DEFINER functions that only ever return counts and dates.
 */

export interface AdminOverviewStats {
  totalUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers7d: number;
  /** Platform-wide trade COUNT — never the trades themselves. */
  totalTrades: number;
  tradesLast7d: number;
  tradingUsers: number;
  paidSubscriptions: number;
  freeSubscriptions: number;
  openFeedback: number;
}

export interface AdminUserStat {
  userId: UUID;
  tradeCount: number;
  firstTradeAt?: ISODateTime;
  lastTradeAt?: ISODateTime;
}

export interface SignupPoint {
  day: ISODate;
  signups: number;
}

/** A user row in the admin directory: profile + plan + activity counts. */
export interface AdminUserRow {
  id: UUID;
  email: string;
  displayName: string;
  phone?: string;
  role: 'user' | 'admin';
  isSuspended: boolean;
  suspendedReason?: string;
  createdAt: ISODateTime;
  lastActiveAt?: ISODateTime;
  planName?: string;
  planCode?: string;
  subscriptionStatus?: string;
  /** How many trades they have recorded. Not what they traded. */
  tradeCount: number;
  lastTradeAt?: ISODateTime;
}

export const AUDIT_ACTIONS = [
  'set_role',
  'suspend_user',
  'unsuspend_user',
  'set_subscription',
  'update_plan',
  'update_instrument',
  'update_feedback',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number] | (string & {});

export interface AuditEntry {
  id: UUID;
  actorId: UUID | null;
  actorEmail?: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  set_role: 'Changed role',
  suspend_user: 'Suspended user',
  unsuspend_user: 'Restored user',
  set_subscription: 'Changed subscription',
  update_plan: 'Updated plan',
  update_instrument: 'Updated instrument',
  update_feedback: 'Triaged feedback',
};
