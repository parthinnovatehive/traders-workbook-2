import dayjs from 'dayjs';
import type {
  AdminUserRow,
  Favourite,
  Feedback,
  FeedbackWithAuthor,
  PaymentOrder,
  Plan,
  RiskSetting,
  SignupPoint,
  Strategy,
  Subscription,
  Trade,
  TradingAccount,
  TradingMode,
  User,
} from '@/types';
import { uid } from '@/utils/id';
import { canCreateStrategy, canCreateTrade, customStrategyLimit } from '@/lib/entitlements';
import { withContentDefaults } from '@/config/content';
import { type Database, DB_VERSION, loadDb, mockHash, saveDb } from './db';
import { buildSeed } from './seed';
import {
  type Api,
  type IAdminRepository,
  type IAuthService,
  type IBillingRepository,
  type IContentRepository,
  type IFavouriteRepository,
  type IFeedbackRepository,
  type IInstrumentRepository,
  type IPlanRepository,
  type IRiskRepository,
  type IStrategyRepository,
  type ITradeRepository,
  type ITradingAccountRepository,
  type ProfilePatch,
  type RegisterInput,
  StrategyLimitError,
  TradeLimitError,
} from './interfaces';

const SESSION_KEY = 'twb.session.v1';

let cache: Database | null = null;

function db(): Database {
  if (cache) return cache;
  const loaded = loadDb();
  if (loaded && loaded.version === DB_VERSION) {
    cache = loaded;
  } else {
    // Stale shape from an older build — rebuild rather than crash on a missing
    // collection. Local data is demo data, so discarding it is safe.
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

/**
 * Local twin of the `log_admin_action` RPC. Every privileged mutation records
 * who did what and the before/after, so the admin section is accountable in
 * both data sources rather than only against Supabase.
 */
function audit(
  action: string,
  targetType: string,
  targetId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): void {
  const actorId = getSession();
  const actor = actorId ? db().users.find((u) => u.id === actorId) : undefined;
  db().auditLog.push({
    id: uid(),
    actorId: actorId ?? null,
    actorEmail: actor?.email,
    action,
    targetType,
    targetId,
    before,
    after,
    createdAt: new Date().toISOString(),
  });
}

/** Listeners for the local twin of Supabase's onAuthStateChange. */
const authListeners = new Set<(user: User | null) => void>();
const emitAuthChange = (user: User | null): void => {
  for (const listener of authListeners) listener(user);
};

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
    emitAuthChange(clone(user));
    return clone(user);
  },

  async register(input: RegisterInput) {
    const exists = db().credentials.some((c) => c.email.toLowerCase() === input.email.toLowerCase());
    if (exists) throw new Error('An account with that email already exists.');

    const now = new Date().toISOString();
    const user: User = {
      id: uid(),
      email: input.email,
      displayName: input.displayName,
      phone: input.phone,
      role: 'user',
      // Legacy mirrors of the Forex account, kept in sync until Phase 2 drops them.
      baseCurrency: input.forexCurrency,
      startingCapital: input.forexStartingCapital,
      createdAt: now,
    };
    db().users.push(user);
    db().credentials.push({
      userId: user.id,
      email: input.email,
      passwordHash: mockHash(input.password),
    });

    // Both books open from day one (request #5). The Indian account is INR.
    db().tradingAccounts.push(
      {
        id: uid(),
        userId: user.id,
        tradingMode: 'forex',
        currency: input.forexCurrency,
        startingCapital: input.forexStartingCapital,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: user.id,
        tradingMode: 'indian',
        currency: 'INR',
        startingCapital: input.indianStartingCapital,
        createdAt: now,
        updatedAt: now,
      },
    );

    // A risk rule set per book — each daily loss limit is denominated in that
    // book's own currency, so they are seeded from that book's capital.
    db().riskSettings.push(
      {
        id: uid(),
        userId: user.id,
        tradingMode: 'forex',
        riskPerTradePct: 1,
        dailyLossLimit: Math.max(1, Math.round(input.forexStartingCapital * 0.03)),
        maxDrawdownPct: 15,
        maxPositionPct: 25,
      },
      {
        id: uid(),
        userId: user.id,
        tradingMode: 'indian',
        riskPerTradePct: 1,
        dailyLossLimit: Math.max(1, Math.round(input.indianStartingCapital * 0.03)),
        maxDrawdownPct: 15,
        maxPositionPct: 25,
      },
    );
    db().subscriptions.push({
      id: uid(),
      userId: user.id,
      planId: 'plan-free',
      status: 'free',
      currentPeriodStart: now,
    });
    commit();
    setSession(user.id);
    emitAuthChange(clone(user));
    return clone(user);
  },

  async logout() {
    setSession(null);
    emitAuthChange(null);
  },

  async updateProfile(userId: string, patch: ProfilePatch) {
    const user = db().users.find((u) => u.id === userId);
    if (!user) throw new Error('Account not found.');
    Object.assign(user, patch);
    commit();
    return clone(user);
  },

  async requestPasswordReset() {
    // No mail server in local mode — the flow is exercised end-to-end against
    // Supabase. Resolving keeps the UI identical in both modes.
  },

  async updatePassword(newPassword: string) {
    const id = getSession();
    if (!id) throw new Error('You are not signed in.');
    const cred = db().credentials.find((c) => c.userId === id);
    if (!cred) throw new Error('Account not found.');
    cred.passwordHash = mockHash(newPassword);
    commit();
  },

  onAuthStateChange(handler) {
    authListeners.add(handler);
    return () => authListeners.delete(handler);
  },

  async completeOnboarding(userId: string) {
    const user = db().users.find((u) => u.id === userId);
    if (!user) throw new Error('Account not found.');
    user.onboardedAt ??= new Date().toISOString();
    commit();
    emitAuthChange(clone(user));
    return clone(user);
  },
};

const accounts: ITradingAccountRepository = {
  async list(userId) {
    const data = db();
    const existing = data.tradingAccounts.filter((a) => a.userId === userId);
    // Self-heal for accounts seeded before this table existed.
    const missing = (['forex', 'indian'] as const).filter(
      (mode) => !existing.some((a) => a.tradingMode === mode),
    );
    if (missing.length > 0) {
      const now = new Date().toISOString();
      for (const mode of missing) {
        data.tradingAccounts.push({
          id: uid(),
          userId,
          tradingMode: mode,
          currency: mode === 'indian' ? 'INR' : 'USD',
          startingCapital: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      commit();
    }
    return clone(
      data.tradingAccounts
        .filter((a) => a.userId === userId)
        .toSorted((a, b) => a.tradingMode.localeCompare(b.tradingMode)),
    );
  },

  async update(userId, tradingMode: TradingMode, patch) {
    await accounts.list(userId); // ensure both rows exist
    const account = db().tradingAccounts.find(
      (a) => a.userId === userId && a.tradingMode === tradingMode,
    ) as TradingAccount;
    if (patch.startingCapital !== undefined) account.startingCapital = patch.startingCapital;
    // The Indian book is always INR — mirrors the CHECK constraint in the DB.
    if (patch.currency !== undefined && tradingMode !== 'indian') account.currency = patch.currency;
    account.updatedAt = new Date().toISOString();
    commit();
    return clone(account);
  },
};

const instruments: IInstrumentRepository = {
  async list(tradingMode) {
    return clone(
      db()
        .instruments.filter((i) => i.isActive && (!tradingMode || i.tradingMode === tradingMode))
        .toSorted((a, b) => a.sortOrder - b.sortOrder || a.symbol.localeCompare(b.symbol)),
    );
  },
};

const favourites: IFavouriteRepository = {
  async list(userId) {
    return clone(db().favourites.filter((f) => f.userId === userId));
  },

  async add(userId, tradingMode: TradingMode, symbol) {
    const data = db();
    const existing = data.favourites.find(
      (f) => f.userId === userId && f.tradingMode === tradingMode && f.symbol === symbol,
    );
    if (existing) return clone(existing);
    const favourite: Favourite = {
      userId,
      tradingMode,
      symbol,
      createdAt: new Date().toISOString(),
    };
    data.favourites.push(favourite);
    commit();
    return clone(favourite);
  },

  async remove(userId, tradingMode: TradingMode, symbol) {
    const data = db();
    data.favourites = data.favourites.filter(
      (f) => !(f.userId === userId && f.tradingMode === tradingMode && f.symbol === symbol),
    );
    commit();
  },
};

const feedback: IFeedbackRepository = {
  async listMine(userId) {
    return clone(
      db()
        .feedback.filter((f) => f.userId === userId)
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  async submit(userId, draft) {
    const now = new Date().toISOString();
    const entry: Feedback = {
      id: uid(),
      userId,
      type: draft.type,
      rating: draft.rating,
      message: draft.message,
      page: draft.page,
      appVersion: draft.appVersion,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
    db().feedback.push(entry);
    commit();
    return clone(entry);
  },
};

const trades: ITradeRepository = {
  async list(userId, filter) {
    return clone(
      db().trades.filter(
        (t) =>
          t.userId === userId &&
          (!filter?.tradingMode || t.tradingMode === filter.tradingMode),
      ),
    );
  },
  async count(userId) {
    return db().trades.filter((t) => t.userId === userId).length;
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
    // The plan's custom-strategy allowance is enforced HERE for the same reason
    // the trade limit is: the repository is the only place a client cannot
    // route around. The Supabase twin is the enforce_strategy_limit trigger.
    const data = db();
    const used = data.strategies.filter((s) => s.userId === userId && !s.isSystem).length;
    const sub = data.subscriptions.find((s) => s.userId === userId) ?? null;
    if (!canCreateStrategy(sub, data.plans, used)) {
      throw new StrategyLimitError(customStrategyLimit(sub, data.plans));
    }
    const strategy: Strategy = {
      id: uid(),
      userId,
      name: input.name,
      description: input.description,
      isSystem: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    data.strategies.push(strategy);
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
  async get(userId, tradingMode: TradingMode) {
    const data = db();
    let setting = data.riskSettings.find(
      (r) => r.userId === userId && r.tradingMode === tradingMode,
    );
    if (!setting) {
      // Self-heal, including for rows written before risk went per-mode: an
      // unmigrated row is adopted as the Forex book's rules rather than lost.
      const legacy = data.riskSettings.find(
        (r) => r.userId === userId && r.tradingMode === undefined,
      );
      if (legacy && tradingMode === 'forex') {
        legacy.tradingMode = 'forex';
        setting = legacy;
      } else {
        setting = {
          id: uid(),
          userId,
          tradingMode,
          riskPerTradePct: 1,
          dailyLossLimit: tradingMode === 'indian' ? 25_000 : 1000,
          maxDrawdownPct: 15,
          maxPositionPct: 25,
        };
        data.riskSettings.push(setting);
      }
      commit();
    }
    return clone(setting);
  },
  async update(userId, tradingMode: TradingMode, patch) {
    await risk.get(userId, tradingMode); // ensure the row exists
    const current = db().riskSettings.find(
      (r) => r.userId === userId && r.tradingMode === tradingMode,
    ) as RiskSetting;
    Object.assign(current, patch);
    commit();
    return clone(current);
  },
};

const content: IContentRepository = {
  async get() {
    return withContentDefaults(clone(db().content));
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

  async create(draft) {
    const data = db();
    const id = draft.id?.trim() || `plan-${draft.code.toLowerCase()}-${draft.billingPeriod}`;
    if (data.plans.some((p) => p.id === id)) {
      throw new Error(`A plan with the id "${id}" already exists.`);
    }
    const plan: Plan = { ...draft, id };
    data.plans.push(plan);
    commit();
    return clone(plan);
  },

  async remove(id) {
    const data = db();
    const plan = data.plans.find((p) => p.id === id);
    if (!plan) throw new Error('Plan not found.');

    // Mirrors the guards in migration 0009, so the mock refuses the same things
    // the real database refuses rather than silently allowing more.
    const subs = data.subscriptions.filter((s) => s.planId === id).length;
    if (subs > 0) {
      throw new Error(
        `Cannot delete "${plan.name}" — ${subs} subscriber${subs === 1 ? '' : 's'} on this plan. Hide it instead.`,
      );
    }
    if (plan.code === 'FREE' && data.plans.filter((p) => p.code === 'FREE').length === 1) {
      throw new Error('Cannot delete the last FREE plan — new signups are placed on it.');
    }

    data.plans = data.plans.filter((p) => p.id !== id);
    commit();
  },
};

const admin: IAdminRepository = {
  async overview() {
    const data = db();
    const since = (days: number) => dayjs().subtract(days, 'day').toISOString();
    const paidPlanIds = new Set(data.plans.filter((p) => p.code !== 'FREE').map((p) => p.id));

    return {
      totalUsers: data.users.length,
      suspendedUsers: data.users.filter((u) => u.isSuspended).length,
      adminUsers: data.users.filter((u) => u.role === 'admin').length,
      newUsers7d: data.users.filter((u) => u.createdAt > since(7)).length,
      newUsers30d: data.users.filter((u) => u.createdAt > since(30)).length,
      activeUsers7d: data.users.filter((u) => (u.lastActiveAt ?? '') > since(7)).length,
      totalTrades: data.trades.length,
      tradesLast7d: data.trades.filter((t) => t.createdAt > since(7)).length,
      tradingUsers: new Set(data.trades.map((t) => t.userId)).size,
      paidSubscriptions: data.subscriptions.filter(
        (s) => paidPlanIds.has(s.planId) && (s.status === 'active' || s.status === 'trialing'),
      ).length,
      freeSubscriptions: data.subscriptions.filter((s) => !paidPlanIds.has(s.planId)).length,
      openFeedback: data.feedback.filter((f) => f.status === 'new' || f.status === 'in_review')
        .length,
    };
  },

  async signupSeries(days = 30) {
    const data = db();
    const points: SignupPoint[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      points.push({
        day,
        signups: data.users.filter((u) => u.createdAt.slice(0, 10) === day).length,
      });
    }
    return points;
  },

  async userRows() {
    const data = db();
    const planById = new Map(data.plans.map((p) => [p.id, p]));
    const subByUser = new Map(data.subscriptions.map((s) => [s.userId, s]));

    return clone(
      data.users.map((u): AdminUserRow => {
        const sub = subByUser.get(u.id);
        const plan = sub ? planById.get(sub.planId) : undefined;
        // Counts only — the admin surface never carries trade detail.
        const theirTrades = data.trades.filter((t) => t.userId === u.id);
        const lastTradeAt = theirTrades
          .map((t) => t.createdAt)
          .toSorted((a, b) => b.localeCompare(a))[0];

        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          phone: u.phone,
          role: u.role,
          isSuspended: u.isSuspended ?? false,
          suspendedReason: u.suspendedReason,
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt,
          planName: plan?.name,
          planCode: plan?.code,
          subscriptionStatus: sub?.status,
          tradeCount: theirTrades.length,
          lastTradeAt,
        };
      }),
    );
  },

  async setUserRole(userId, role) {
    const data = db();
    const user = data.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (userId === getSession() && role !== 'admin') {
      throw new Error('You cannot remove your own admin role.');
    }
    audit('set_role', 'user', userId, { role: user.role }, { role });
    user.role = role;
    commit();
  },

  async setUserSuspended(userId, suspended, reason) {
    const data = db();
    const user = data.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (userId === getSession()) throw new Error('You cannot suspend your own account.');
    audit(
      suspended ? 'suspend_user' : 'unsuspend_user',
      'user',
      userId,
      { isSuspended: user.isSuspended ?? false },
      { isSuspended: suspended, reason },
    );
    user.isSuspended = suspended;
    user.suspendedReason = suspended ? reason : undefined;
    commit();
  },

  async setSubscription(userId, planId, status = 'active', months = 1) {
    const data = db();
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    const existing = data.subscriptions.find((s) => s.userId === userId);
    const before = existing ? { ...existing } : null;

    if (existing) {
      existing.planId = planId;
      existing.status = status as Subscription['status'];
      existing.currentPeriodStart = now.toISOString();
      existing.currentPeriodEnd =
        status === 'active' || status === 'trialing' ? end.toISOString() : undefined;
    } else {
      data.subscriptions.push({
        id: uid(),
        userId,
        planId,
        status: status as Subscription['status'],
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd:
          status === 'active' || status === 'trialing' ? end.toISOString() : undefined,
      });
    }
    audit('set_subscription', 'subscription', userId, before ?? undefined, {
      planId,
      status,
      months,
    });
    commit();
  },

  async updateInstrument(id, patch) {
    const instrument = db().instruments.find((i) => i.id === id);
    if (!instrument) throw new Error('Instrument not found.');
    const before = { ...instrument };
    Object.assign(instrument, patch);
    audit('update_instrument', 'instrument', id, { lotSize: before.lotSize }, patch);
    commit();
    return clone(instrument);
  },

  async updateContent(patch) {
    const data = db();
    const before = clone(data.content);
    data.content = withContentDefaults({ ...data.content, ...patch });
    data.content.updatedAt = new Date().toISOString();
    // Store which sections changed, not the full before/after bodies — an audit
    // row carrying entire marketing pages is noise in the log.
    audit('update_content', 'content', 'site', { sections: Object.keys(before) }, {
      sections: Object.keys(patch),
    });
    commit();
    return clone(data.content);
  },

  async auditLog(limit = 200) {
    return clone(
      db()
        .auditLog.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  },

  async subscriptions() {
    return clone(db().subscriptions);
  },
  async feedback() {
    const data = db();
    const byId = new Map(data.users.map((u) => [u.id, u]));
    return clone(
      data.feedback
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((f): FeedbackWithAuthor => {
          const author = f.userId ? byId.get(f.userId) : undefined;
          return { ...f, authorName: author?.displayName, authorEmail: author?.email };
        }),
    );
  },
  async updateFeedback(id, patch) {
    const entry = db().feedback.find((f) => f.id === id);
    if (!entry) throw new Error('Feedback not found.');
    Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
    commit();
    return clone(entry);
  },
};

const billing: IBillingRepository = {
  async getSubscription(userId) {
    return clone(db().subscriptions.find((s) => s.userId === userId) ?? null);
  },
  async tradeCount(userId) {
    return db().trades.filter((t) => t.userId === userId).length;
  },
  /** Mirrors `create_payment_order`: priced from the plan, never the caller. */
  async createOrder(userId, planId) {
    const data = db();
    const plan = data.plans.find((p) => p.id === planId && p.isActive);
    if (!plan) throw new Error('That plan is not available.');
    if (plan.price <= 0) throw new Error('The free plan does not require payment.');

    const order: PaymentOrder = {
      id: uid(),
      userId,
      planId,
      amount: plan.price,
      currency: plan.currency,
      status: 'created',
      provider: 'mock',
      createdAt: new Date().toISOString(),
    };
    data.paymentOrders.push(order);
    commit();
    return clone(order);
  },

  /**
   * Mirrors `confirm_payment_order`, including the guards that matter: an order
   * settles once, and only the order's owner can settle it.
   */
  async confirmPayment(userId, orderId, result) {
    const data = db();
    const order = data.paymentOrders.find((o) => o.id === orderId && o.userId === userId);
    if (!order) throw new Error('Order not found.');
    if (order.status === 'paid') throw new Error('That order has already been paid.');
    if (order.status !== 'created') throw new Error('That order can no longer be paid.');

    const plan = data.plans.find((p) => p.id === order.planId);
    if (!plan) throw new Error('Plan not found.');

    const now = new Date();
    const end = new Date(now);
    if (plan.billingPeriod === 'yearly') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    order.status = 'paid';
    order.providerPaymentId = result.paymentId;
    order.paidAt = now.toISOString();

    let sub = data.subscriptions.find((s) => s.userId === userId);
    if (sub) {
      sub.planId = order.planId;
      sub.status = 'active';
      sub.currentPeriodStart = now.toISOString();
      sub.currentPeriodEnd = end.toISOString();
    } else {
      sub = {
        id: uid(),
        userId,
        planId: order.planId,
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
      };
      data.subscriptions.push(sub);
    }
    commit();
    return { order: clone(order), subscription: clone(sub) };
  },

  async failOrder(userId, orderId, reason) {
    const data = db();
    const order = data.paymentOrders.find((o) => o.id === orderId && o.userId === userId);
    if (!order || order.status !== 'created') throw new Error('Order not found.');
    order.status = 'failed';
    order.failureReason = reason.slice(0, 500);
    commit();
    return clone(order);
  },

  async orders(userId) {
    return clone(
      db()
        .paymentOrders.filter((o) => o.userId === userId)
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  async cancel(userId) {
    const data = db();
    const sub = data.subscriptions.find((s) => s.userId === userId);
    if (!sub) throw new Error('No subscription to cancel.');
    sub.status = 'canceled';
    commit();
    return clone(sub);
  },
};

export const localApi: Api = {
  auth,
  trades,
  strategies,
  risk,
  plans,
  accounts,
  instruments,
  favourites,
  feedback,
  content,
  admin,
  billing,
};
