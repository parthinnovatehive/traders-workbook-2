import type {
  AuditEntry,
  Favourite,
  Feedback,
  Instrument,
  Plan,
  RiskSetting,
  Strategy,
  Subscription,
  Trade,
  TradingAccount,
  User,
} from '@/types';

/** Mock credential store (local dev only — never how real auth would work). */
export interface Credential {
  userId: string;
  email: string;
  passwordHash: string;
}

export interface Database {
  version: number;
  users: User[];
  credentials: Credential[];
  tradingAccounts: TradingAccount[];
  trades: Trade[];
  strategies: Strategy[];
  riskSettings: RiskSetting[];
  plans: Plan[];
  subscriptions: Subscription[];
  instruments: Instrument[];
  favourites: Favourite[];
  feedback: Feedback[];
  auditLog: AuditEntry[];
}

/**
 * Bumped whenever the shape changes. `local.ts` discards any stored database
 * with a different version and rebuilds from the seed, so a developer's stale
 * browser data can never crash the app after a schema change.
 */
export const DB_VERSION = 4;

const KEY = 'twb.db.v1';

export function loadDb(): Database | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Database) : null;
  } catch {
    return null;
  }
}

export function saveDb(db: Database): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage unavailable (private mode / quota) — app still works in-memory
  }
}

export function clearDb(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** A trivial reversible "hash" — this is a mock, not real security. */
export const mockHash = (password: string): string => btoa(unescape(encodeURIComponent(password)));
