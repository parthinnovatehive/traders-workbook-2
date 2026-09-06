import type { Plan, RiskSetting, Strategy, Subscription, Trade, User } from '@/types';

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
  trades: Trade[];
  strategies: Strategy[];
  riskSettings: RiskSetting[];
  plans: Plan[];
  subscriptions: Subscription[];
}

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
