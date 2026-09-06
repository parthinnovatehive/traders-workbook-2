import type { Plan, RiskSetting, Strategy, Trade, User } from '@/types';
import { uid } from '@/utils/id';
import { canCreateTrade } from '@/lib/entitlements';
import { type Database, loadDb, mockHash, saveDb } from './db';
import { buildSeed } from './seed';
import {
  type Api,
  type IAdminRepository,
  type IAuthService,
  type IBillingRepository,
  type IPlanRepository,
  type IRiskRepository,
  type IStrategyRepository,
  type ITradeRepository,
  type ProfilePatch,
  type RegisterInput,
  TradeLimitError,
} from './interfaces';

const SESSION_KEY = 'twb.session.v1';

let cache: Database | null = null;

function db(): Database {
  if (cache) return cache;
  const loaded = loadDb();
  if (loaded && loaded.version === 2) {
    cache = loaded;
  } else {
    cache = buildSeed();
    saveDb(cache);
  }
  return cache;
}

function commit(): void {
  if (cache) saveDb(cache);
}

function getSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setSession(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Reset all local data back to the seeded demo state. */
export function resetLocalData(): void {
  cache = buildSeed();
  saveDb(cache);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const auth: IAuthService = {
  async getCurrentUser() {
    const id = getSession();
    if (!id) return null;
    return db().users.find((u) => u.id === id) ?? null;
  },

  async login(email, password) {
    const cred = db().credentials.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (!cred || cred.passwordHash !== mockHash(password)) {
      throw new Error('Invalid email or password.');
    }
    setSession(cred.userId);
    const user = db().users.find((u) => u.id === cred.userId);
    if (!user) throw new Error('Account not found.');
    return clone(user);
  },

  async register(input: RegisterInput) {
    const exists = db().credentials.some((c) => c.email.toLowerCase() === input.email.toLowerCase());
    if (exists) throw new Error('An account with that email already exists.');

    const user: User = {
      id: uid(),
      email: input.email,
      displayName: input.displayName,
      role: 'user',
      baseCurrency: input.baseCurrency,
      startingCapital: input.startingCapital,
      createdAt: new Date().toISOString(),
    };
    db().users.push(user);
    db().credentials.push({
      userId: user.id,
      email: input.email,
      passwordHash: mockHash(input.password),
    });
    db().riskSettings.push({
      id: uid(),
      userId: user.id,
      riskPerTradePct: 1,
      dailyLossLimit: Math.max(1, Math.round(input.startingCapital * 0.03)),
      maxDrawdownPct: 15,
      maxPositionPct: 25,
    });
    db().subscriptions.push({
      id: uid(),
      userId: user.id,
      planId: 'plan-free',
      status: 'free',
      currentPeriodStart: new Date().toISOString(),
    });
    commit();
    setSession(user.id);
    return clone(user);
  },

  async logout() {
    setSession(null);
  },

  async updateProfile(userId: string, patch: ProfilePatch) {
    const user = db().users.find((u) => u.id === userId);
    if (!user) throw new Error('Account not found.');
    Object.assign(user, patch);
    commit();
    return clone(user);
  },
};

const trades: ITradeRepository = {
  async list(userId) {
    return clone(db().trades.filter((t) => t.userId === userId));
  },
  async get(userId, id) {
    return clone(db().trades.find((t) => t.userId === userId && t.id === id) ?? null);
  },
  async create(userId, draft) {
    // Enforce the free-trade limit HERE (repository = source of truth), so it
    // cannot be bypassed by refreshing, clearing storage or editing UI state.
    const data = db();
    const count = data.trades.filter((t) => t.userId === userId).length;
    const sub = data.subscriptions.find((s) => s.userId === userId) ?? null;
    if (!canCreateTrade(sub, data.plans, count)) {
      throw new TradeLimitError();
    }
    const now = new Date().toISOString();
    const trade: Trade = { ...draft, id: uid(), userId, createdAt: now, updatedAt: now };
    data.trades.push(trade);
    commit();
    return clone(trade);
  },
  async update(userId, id, patch) {
    const trade = db().trades.find((t) => t.userId === userId && t.id === id);
    if (!trade) throw new Error('Trade not found.');
    Object.assign(trade, patch, { updatedAt: new Date().toISOString() });
    commit();
    return clone(trade);
  },
  async remove(userId, id) {
    const data = db();
    data.trades = data.trades.filter((t) => !(t.userId === userId && t.id === id));
    commit();
  },
};

const strategies: IStrategyRepository = {
  async list(userId) {
    return clone(db().strategies.filter((s) => s.isSystem || s.userId === userId));
  },
  async create(userId, input) {
    const strategy: Strategy = {
      id: uid(),
      userId,
      name: input.name,
      description: input.description,
      isSystem: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db().strategies.push(strategy);
    commit();
    return clone(strategy);
  },
  async update(userId, id, patch) {
    const strategy = db().strategies.find((s) => s.userId === userId && s.id === id);
    if (!strategy) throw new Error('Strategy not found.');
    Object.assign(strategy, patch);
    commit();
    return clone(strategy);
  },
  async remove(userId, id) {
    const data = db();
    data.strategies = data.strategies.filter(
      (s) => !(s.userId === userId && s.id === id && !s.isSystem),
    );
    commit();
  },
};

const risk: IRiskRepository = {
  async get(userId) {
    let setting = db().riskSettings.find((r) => r.userId === userId);
    if (!setting) {
      setting = {
        id: uid(),
        userId,
        riskPerTradePct: 1,
        dailyLossLimit: 1000,
        maxDrawdownPct: 15,
        maxPositionPct: 25,
      };
      db().riskSettings.push(setting);
      commit();
    }
    return clone(setting);
  },
  async update(userId, patch) {
    await risk.get(userId); // ensure a row exists
    const current = db().riskSettings.find((r) => r.userId === userId) as RiskSetting;
    Object.assign(current, patch);
    commit();
    return clone(current);
  },
};

const plans: IPlanRepository = {
  async list() {
    return clone(db().plans.toSorted((a, b) => a.sortOrder - b.sortOrder));
  },
  async update(id, patch) {
    const plan = db().plans.find((p) => p.id === id);
    if (!plan) throw new Error('Plan not found.');
    Object.assign(plan, patch);
    commit();
    return clone(plan as Plan);
  },
};

const admin: IAdminRepository = {
  async users() {
    return clone(db().users);
  },
  async subscriptions() {
    return clone(db().subscriptions);
  },
};

const billing: IBillingRepository = {
  async getSubscription(userId) {
    return clone(db().subscriptions.find((s) => s.userId === userId) ?? null);
  },
  async tradeCount(userId) {
    return db().trades.filter((t) => t.userId === userId).length;
  },
  async subscribe(userId, planId) {
    const data = db();
    const plan = data.plans.find((p) => p.id === planId);
    if (!plan) throw new Error('Plan not found.');
    const now = new Date();
    const end = new Date(now);
    if (plan.billingPeriod === 'yearly') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    let sub = data.subscriptions.find((s) => s.userId === userId);
    const status = plan.code === 'FREE' ? 'free' : 'active';
    if (sub) {
      sub.planId = planId;
      sub.status = status;
      sub.currentPeriodStart = now.toISOString();
      sub.currentPeriodEnd = plan.code === 'FREE' ? undefined : end.toISOString();
    } else {
      sub = {
        id: uid(),
        userId,
        planId,
        status,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: plan.code === 'FREE' ? undefined : end.toISOString(),
      };
      data.subscriptions.push(sub);
    }
    commit();
    return clone(sub);
  },
  async cancel(userId) {
    const data = db();
    const sub = data.subscriptions.find((s) => s.userId === userId);
    if (!sub) throw new Error('No subscription found.');
    sub.status = 'canceled';
    commit();
    return clone(sub);
  },
};

export const localApi: Api = { auth, trades, strategies, risk, plans, admin, billing };
