import type { PostgrestError, Session } from '@supabase/supabase-js';
import type {
  AdminOverviewStats,
  AdminUserRow,
  AuditEntry,
  BillingPeriod,
  Favourite,
  Feedback,
  FeedbackDraft,
  FeedbackPatch,
  FeedbackStatus,
  FeedbackType,
  FeedbackWithAuthor,
  IndianSegment,
  Instrument,
  InstrumentCategory,
  Market,
  MistakeCode,
  Plan,
  PlanCode,
  PsychCode,
  RiskSetting,
  SiteContent,
  Strategy,
  Subscription,
  SubscriptionStatus,
  Trade,
  TradeDirection,
  TradeDraft,
  TradingAccount,
  TradingAccountPatch,
  TradingMode,
  User,
} from '@/types';
import { uid } from '@/utils/id';
import { canCreateStrategy, canCreateTrade, customStrategyLimit } from '@/lib/entitlements';
import { DEFAULT_CONTENT, withContentDefaults } from '@/config/content';
import type {
  Api,
  IAdminRepository,
  IAuthService,
  IBillingRepository,
  IContentRepository,
  IFavouriteRepository,
  IFeedbackRepository,
  IInstrumentRepository,
  IPlanRepository,
  IRiskRepository,
  IStrategyRepository,
  ITradeRepository,
  ITradingAccountRepository,
  ProfilePatch,
  RegisterInput,
} from './interfaces';
import { StrategyLimitError, TradeLimitError } from './interfaces';
import { getSupabase } from './supabaseClient';

/* -------------------------------------------------------------------------- */
/* Row shapes (DB snake_case) — mirror supabase/migrations/*.sql              */
/* -------------------------------------------------------------------------- */

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  role: string;
  base_currency: string;
  starting_capital: number;
  created_at: string;
  is_suspended?: boolean | null;
  suspended_reason?: string | null;
  last_active_at?: string | null;
  onboarded_at?: string | null;
}

interface TradingAccountRow {
  id: string;
  user_id: string;
  trading_mode: string;
  currency: string;
  starting_capital: number;
  created_at: string;
  updated_at: string;
}

interface InstrumentRow {
  id: string;
  trading_mode: string;
  symbol: string;
  name: string;
  exchange: string | null;
  also_on: string[] | null;
  segment: string | null;
  has_fno: boolean | null;
  base_currency: string | null;
  quote_currency: string | null;
  contract_size: number;
  lot_size: number;
  pip_size: number | null;
  tick_size: number;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

interface FavouriteRow {
  user_id: string;
  trading_mode: string;
  symbol: string;
  created_at: string;
}

interface FeedbackRow {
  id: string;
  user_id: string | null;
  type: string;
  rating: number | null;
  message: string;
  page: string | null;
  app_version: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

interface StrategyRow {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  price: number;
  billing_period: string;
  currency: string;
  features: string[];
  limits: Record<string, number | boolean>;
  is_active: boolean;
  sort_order: number;
}

interface TradeRow {
  id: string;
  user_id: string;
  trading_mode: string | null;
  entry_date: string;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
  symbol: string;
  market: string;
  direction: string;
  base_currency: string | null;
  quote_currency: string | null;
  lot_type: string | null;
  exchange: string | null;
  segment: string | null;
  account_currency: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  lot_size: number | null;
  stop_loss: number | null;
  target: number | null;
  charges: number;
  conversion_rate: number | null;
  pip_distance: number | null;
  pip_value: number | null;
  strategy_id: string | null;
  setup: string | null;
  market_condition: string | null;
  notes: string | null;
  psychology: string[];
  mistakes: string[];
  created_at: string;
  updated_at: string;
}

interface RiskRow {
  id: string;
  user_id: string;
  trading_mode: string | null;
  risk_per_trade_pct: number;
  daily_loss_limit: number;
  max_drawdown_pct: number;
  max_position_pct: number;
}

interface SiteContentRow {
  id: string;
  announcement: unknown;
  marketing: unknown;
  faqs: unknown;
  updated_at: string | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

/* -------------------------------------------------------------------------- */
/* Row → domain mappers                                                        */
/* -------------------------------------------------------------------------- */

function toUser(r: ProfileRow): User {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    phone: r.phone ?? undefined,
    role: r.role === 'admin' ? 'admin' : 'user',
    baseCurrency: r.base_currency,
    startingCapital: Number(r.starting_capital),
    createdAt: r.created_at,
    isSuspended: r.is_suspended ?? false,
    suspendedReason: r.suspended_reason ?? undefined,
    lastActiveAt: r.last_active_at ?? undefined,
    onboardedAt: r.onboarded_at ?? undefined,
  };
}

const toMode = (v: string | null): TradingMode => (v === 'indian' ? 'indian' : 'forex');

function toTradingAccount(r: TradingAccountRow): TradingAccount {
  return {
    id: r.id,
    userId: r.user_id,
    tradingMode: toMode(r.trading_mode),
    currency: r.currency,
    startingCapital: Number(r.starting_capital),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toInstrument(r: InstrumentRow): Instrument {
  return {
    id: r.id,
    tradingMode: toMode(r.trading_mode),
    symbol: r.symbol,
    name: r.name,
    exchange: r.exchange ?? undefined,
    alsoOn: r.also_on ?? [],
    segment: (r.segment as IndianSegment | null) ?? undefined,
    hasFno: r.has_fno ?? false,
    baseCurrency: r.base_currency ?? undefined,
    quoteCurrency: r.quote_currency ?? undefined,
    contractSize: Number(r.contract_size),
    lotSize: Number(r.lot_size),
    pipSize: r.pip_size === null ? undefined : Number(r.pip_size),
    tickSize: Number(r.tick_size),
    category: (r.category as InstrumentCategory | null) ?? undefined,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  };
}

function toFavourite(r: FavouriteRow): Favourite {
  return {
    userId: r.user_id,
    tradingMode: toMode(r.trading_mode),
    symbol: r.symbol,
    createdAt: r.created_at,
  };
}

function toFeedback(r: FeedbackRow): Feedback {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type as FeedbackType,
    rating: r.rating ?? undefined,
    message: r.message,
    page: r.page ?? undefined,
    appVersion: r.app_version ?? undefined,
    status: r.status as FeedbackStatus,
    adminNote: r.admin_note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toStrategy(r: StrategyRow): Strategy {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description ?? undefined,
    isSystem: r.is_system,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

function toPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    code: r.code as PlanCode,
    name: r.name,
    price: Number(r.price),
    billingPeriod: r.billing_period as BillingPeriod,
    currency: r.currency,
    features: r.features ?? [],
    limits: r.limits ?? {},
    isActive: r.is_active,
    sortOrder: r.sort_order,
  };
}

function toTrade(r: TradeRow): Trade {
  return {
    id: r.id,
    userId: r.user_id,
    tradingMode:
      r.trading_mode === 'forex' || r.trading_mode === 'indian' ? r.trading_mode : undefined,
    entryDate: r.entry_date,
    entryTime: r.entry_time ?? undefined,
    exitDate: r.exit_date ?? undefined,
    exitTime: r.exit_time ?? undefined,
    symbol: r.symbol,
    market: r.market as Market,
    direction: r.direction as TradeDirection,
    baseCurrency: r.base_currency ?? undefined,
    quoteCurrency: r.quote_currency ?? undefined,
    lotType: r.lot_type ?? undefined,
    exchange: r.exchange ?? undefined,
    segment: r.segment ?? undefined,
    accountCurrency: r.account_currency ?? undefined,
    entryPrice: Number(r.entry_price),
    exitPrice: r.exit_price === null ? null : Number(r.exit_price),
    quantity: Number(r.quantity),
    lotSize: r.lot_size === null ? undefined : Number(r.lot_size),
    stopLoss: r.stop_loss === null ? null : Number(r.stop_loss),
    target: r.target === null ? null : Number(r.target),
    charges: Number(r.charges),
    conversionRate: r.conversion_rate ?? undefined,
    pipDistance: r.pip_distance ?? undefined,
    pipValue: r.pip_value ?? undefined,
    strategyId: r.strategy_id,
    setup: r.setup ?? undefined,
    marketCondition: r.market_condition ?? undefined,
    notes: r.notes ?? undefined,
    psychology: (r.psychology ?? []) as PsychCode[],
    mistakes: (r.mistakes ?? []) as MistakeCode[],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toRisk(r: RiskRow): RiskSetting {
  return {
    id: r.id,
    userId: r.user_id,
    tradingMode: toMode(r.trading_mode),
    riskPerTradePct: Number(r.risk_per_trade_pct),
    dailyLossLimit: Number(r.daily_loss_limit),
    maxDrawdownPct: Number(r.max_drawdown_pct),
    maxPositionPct: Number(r.max_position_pct),
  };
}

function toSubscription(r: SubscriptionRow): Subscription {
  return {
    id: r.id,
    userId: r.user_id,
    planId: r.plan_id,
    status: r.status as SubscriptionStatus,
    currentPeriodStart: r.current_period_start ?? undefined,
    currentPeriodEnd: r.current_period_end ?? undefined,
  };
}

/** Expands a full TradeDraft into a fresh INSERT row. */
function draftToRow(d: TradeDraft, userId: string): Record<string, unknown> {
  return {
    user_id: userId,
    trading_mode: d.tradingMode ?? null,
    entry_date: d.entryDate,
    entry_time: d.entryTime ?? null,
    exit_date: d.exitDate ?? null,
    exit_time: d.exitTime ?? null,
    symbol: d.symbol,
    market: d.market,
    direction: d.direction,
    base_currency: d.baseCurrency ?? null,
    quote_currency: d.quoteCurrency ?? null,
    lot_type: d.lotType ?? null,
    exchange: d.exchange ?? null,
    segment: d.segment ?? null,
    account_currency: d.accountCurrency ?? null,
    entry_price: d.entryPrice,
    exit_price: d.exitPrice,
    quantity: d.quantity,
    lot_size: d.lotSize ?? null,
    stop_loss: d.stopLoss,
    target: d.target,
    charges: d.charges,
    conversion_rate: d.conversionRate ?? null,
    pip_distance: d.pipDistance ?? null,
    pip_value: d.pipValue ?? null,
    strategy_id: d.strategyId,
    setup: d.setup ?? null,
    market_condition: d.marketCondition ?? null,
    notes: d.notes ?? null,
    psychology: d.psychology,
    mistakes: d.mistakes,
  };
}

/** Builds an UPDATE row that ONLY touches the explicitly-provided keys. */
function patchToRow(patch: Partial<TradeDraft>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.tradingMode !== undefined) row.trading_mode = patch.tradingMode;
  if (patch.entryDate !== undefined) row.entry_date = patch.entryDate;
  if (patch.entryTime !== undefined) row.entry_time = patch.entryTime;
  if (patch.exitDate !== undefined) row.exit_date = patch.exitDate;
  if (patch.exitTime !== undefined) row.exit_time = patch.exitTime;
  if (patch.symbol !== undefined) row.symbol = patch.symbol;
  if (patch.market !== undefined) row.market = patch.market;
  if (patch.direction !== undefined) row.direction = patch.direction;
  if (patch.baseCurrency !== undefined) row.base_currency = patch.baseCurrency;
  if (patch.quoteCurrency !== undefined) row.quote_currency = patch.quoteCurrency;
  if (patch.lotType !== undefined) row.lot_type = patch.lotType;
  if (patch.exchange !== undefined) row.exchange = patch.exchange;
  if (patch.segment !== undefined) row.segment = patch.segment;
  if (patch.accountCurrency !== undefined) row.account_currency = patch.accountCurrency;
  if (patch.entryPrice !== undefined) row.entry_price = patch.entryPrice;
  if (patch.exitPrice !== undefined) row.exit_price = patch.exitPrice;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.lotSize !== undefined) row.lot_size = patch.lotSize;
  if (patch.stopLoss !== undefined) row.stop_loss = patch.stopLoss;
  if (patch.target !== undefined) row.target = patch.target;
  if (patch.charges !== undefined) row.charges = patch.charges;
  if (patch.conversionRate !== undefined) row.conversion_rate = patch.conversionRate;
  if (patch.pipDistance !== undefined) row.pip_distance = patch.pipDistance;
  if (patch.pipValue !== undefined) row.pip_value = patch.pipValue;
  if (patch.strategyId !== undefined) row.strategy_id = patch.strategyId;
  if (patch.setup !== undefined) row.setup = patch.setup;
  if (patch.marketCondition !== undefined) row.market_condition = patch.marketCondition;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.psychology !== undefined) row.psychology = patch.psychology;
  if (patch.mistakes !== undefined) row.mistakes = patch.mistakes;
  return row;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function unwrap<T>(data: T | null | undefined, error: PostgrestError | null, message: string): T {
  if (error) {
    if (error.code === 'P0001') throw new TradeLimitError(error.message);
    throw new Error(`${message}: ${error.message}`);
  }
  return data as T;
}

/**
 * The profile row for an authenticated user. `handle_new_user` creates it on
 * signup, but a user created straight in the Supabase dashboard won't have one —
 * so fall back to a minimal profile rather than logging them out.
 */
async function fetchProfile(session: Session): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) return null;
  if (data) return toUser(data as ProfileRow);

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    displayName: session.user.email?.split('@')[0] ?? 'Trader',
    role: 'user',
    baseCurrency: 'USD',
    startingCapital: 0,
    createdAt: session.user.created_at ?? new Date().toISOString(),
  };
}

/** The signed-in user's id, or throw — every repository call needs one. */
async function requireUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('You are not signed in.');
  return id;
}

/**
 * Client-side twin of the DB trigger: throws the typed `TradeLimitError` the UI
 * understands before the INSERT is attempted. The `trades_enforce_limit` trigger
 * remains the server-side source of truth.
 */
async function assertCanCreateTrade(userId: string): Promise<void> {
  const sb = getSupabase();
  const [subRes, plansRes, countRes] = await Promise.all([
    sb.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('plans').select('*'),
    sb.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  const sub = subRes.data ? toSubscription(subRes.data as SubscriptionRow) : null;
  const plans = ((plansRes.data ?? []) as PlanRow[]).map(toPlan);
  const used = countRes.count ?? 0;
  if (!canCreateTrade(sub, plans, used)) throw new TradeLimitError();
}

/**
 * Twin of the `enforce_strategy_limit` trigger, so the UI can show the typed
 * error before the INSERT is attempted. The trigger stays authoritative.
 */
async function assertCanCreateStrategy(userId: string): Promise<void> {
  const sb = getSupabase();
  const [subRes, plansRes, countRes] = await Promise.all([
    sb.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('plans').select('*'),
    sb
      .from('strategies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_system', false),
  ]);
  const sub = subRes.data ? toSubscription(subRes.data as SubscriptionRow) : null;
  const plans = ((plansRes.data ?? []) as PlanRow[]).map(toPlan);
  const used = countRes.count ?? 0;
  if (!canCreateStrategy(sub, plans, used)) {
    throw new StrategyLimitError(customStrategyLimit(sub, plans));
  }
}

function toSiteContent(r: SiteContentRow): SiteContent {
  return withContentDefaults({
    announcement: r.announcement as SiteContent['announcement'],
    marketing: r.marketing as SiteContent['marketing'],
    faqs: (r.faqs ?? []) as SiteContent['faqs'],
    updatedAt: r.updated_at ?? undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* Auth — Supabase Auth. No passwords, sessions or ids are handled by us.      */
/* -------------------------------------------------------------------------- */

const auth: IAuthService = {
  async getCurrentUser() {
    const { data } = await getSupabase().auth.getSession();
    if (!data.session) return null;
    return fetchProfile(data.session);
  },

  async login(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      // Don't leak whether the address exists.
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Please confirm your email address first — check your inbox.');
      }
      throw new Error('Invalid email or password.');
    }
    if (!data.session) throw new Error('Could not start a session. Please try again.');
    const user = await fetchProfile(data.session);
    if (!user) throw new Error('Account not found.');
    return user;
  },

  async register(input: RegisterInput) {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // Consumed by the handle_new_user() trigger to open both accounts.
        data: {
          display_name: input.displayName,
          phone: input.phone ?? null,
          forex_currency: input.forexCurrency,
          forex_starting_capital: input.forexStartingCapital,
          indian_starting_capital: input.indianStartingCapital,
        },
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('already registered') || message.includes('already exists')) {
        throw new Error('An account with that email already exists.');
      }
      throw new Error(error.message);
    }

    // No session => the project has email confirmation on. Caller shows a
    // "check your inbox" screen instead of navigating into the app.
    if (!data.session) return null;
    return fetchProfile(data.session);
  },

  async logout() {
    await getSupabase().auth.signOut();
  },

  async updateProfile(userId, patch: ProfilePatch) {
    const row: Record<string, string | null> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.phone !== undefined) row.phone = patch.phone ?? null;

    const { data, error } = await getSupabase()
      .from('profiles')
      .update(row)
      .eq('id', userId)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update profile');
    return toUser(updated as ProfileRow);
  },

  async requestPasswordReset(email) {
    await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Intentionally ignore the result: revealing which addresses exist would
    // turn this endpoint into an account-enumeration oracle.
  },

  async updatePassword(newPassword) {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  onAuthStateChange(handler) {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (!session) {
        handler(null);
        return;
      }
      void fetchProfile(session).then(handler);
    });
    return () => data.subscription.unsubscribe();
  },

  async completeOnboarding(userId) {
    const { data, error } = await getSupabase()
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to finish onboarding');
    return toUser(updated as ProfileRow);
  },
};

/* -------------------------------------------------------------------------- */
/* Repositories                                                                */
/* -------------------------------------------------------------------------- */

const trades: ITradeRepository = {
  async list(userId, filter) {
    // Narrowed to one book server-side: no page ever renders both modes at
    // once, so shipping the other one's rows is payload that grows with the
    // user's history and is thrown away on arrival.
    let query = getSupabase().from('trades').select('*').eq('user_id', userId);
    if (filter?.tradingMode) query = query.eq('trading_mode', filter.tradingMode);

    const { data, error } = await query.order('created_at', { ascending: false });
    const rows = unwrap(data, error, 'Failed to load trades') as TradeRow[];
    return rows.map(toTrade);
  },

  async count(userId) {
    const { count, error } = await getSupabase()
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to count trades: ${error.message}`);
    return count ?? 0;
  },

  async get(userId, id) {
    const { data, error } = await getSupabase()
      .from('trades')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    const row = unwrap(data, error, 'Failed to load trade');
    return row ? toTrade(row as TradeRow) : null;
  },

  async create(userId, draft) {
    await assertCanCreateTrade(userId);
    const { data, error } = await getSupabase()
      .from('trades')
      .insert(draftToRow(draft, userId))
      .select()
      .single();
    const row = unwrap(data, error, 'Failed to create trade');
    return toTrade(row as TradeRow);
  },

  async update(userId, id, patch) {
    const { data, error } = await getSupabase()
      .from('trades')
      .update(patchToRow(patch))
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update trade');
    return toTrade(updated as TradeRow);
  },

  async remove(userId, id) {
    const { error } = await getSupabase().from('trades').delete().eq('id', id).eq('user_id', userId);
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to delete trade: ${error.message}`);
    }
  },
};

const accounts: ITradingAccountRepository = {
  async list(userId) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('trading_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('trading_mode');
    const rows = unwrap(data, error, 'Failed to load trading accounts') as TradingAccountRow[];

    // Self-heal: a user created before this table existed (or straight in the
    // dashboard) gets both accounts on first read rather than an empty page.
    if (rows.length < 2) {
      const existing = new Set(rows.map((r) => r.trading_mode));
      const missing = (['forex', 'indian'] as const)
        .filter((m) => !existing.has(m))
        .map((m) => ({
          user_id: userId,
          trading_mode: m,
          currency: m === 'indian' ? 'INR' : 'USD',
          starting_capital: 0,
        }));
      const { data: created } = await sb
        .from('trading_accounts')
        .upsert(missing, { onConflict: 'user_id,trading_mode' })
        .select();
      return [...rows, ...((created ?? []) as TradingAccountRow[])].map(toTradingAccount);
    }

    return rows.map(toTradingAccount);
  },

  async update(userId, tradingMode, patch: TradingAccountPatch) {
    const row: Record<string, string | number> = {};
    // The Indian book is always INR — the DB has a CHECK for this, so silently
    // ignoring a bad currency here keeps the error surface small.
    if (patch.currency !== undefined && tradingMode !== 'indian') row.currency = patch.currency;
    if (patch.startingCapital !== undefined) row.starting_capital = patch.startingCapital;

    const { data, error } = await getSupabase()
      .from('trading_accounts')
      .update(row)
      .eq('user_id', userId)
      .eq('trading_mode', tradingMode)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update trading account');
    return toTradingAccount(updated as TradingAccountRow);
  },
};

const instruments: IInstrumentRepository = {
  async list(tradingMode) {
    let query = getSupabase()
      .from('instruments')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('symbol');
    if (tradingMode) query = query.eq('trading_mode', tradingMode);

    const { data, error } = await query;
    const rows = unwrap(data, error, 'Failed to load instruments') as InstrumentRow[];
    return rows.map(toInstrument);
  },
};

const favourites: IFavouriteRepository = {
  async list(userId) {
    const { data, error } = await getSupabase()
      .from('user_favourites')
      .select('*')
      .eq('user_id', userId);
    const rows = unwrap(data, error, 'Failed to load favourites') as FavouriteRow[];
    return rows.map(toFavourite);
  },

  async add(userId, tradingMode, symbol) {
    const { data, error } = await getSupabase()
      .from('user_favourites')
      .upsert(
        { user_id: userId, trading_mode: tradingMode, symbol },
        { onConflict: 'user_id,trading_mode,symbol' },
      )
      .select()
      .single();
    const row = unwrap(data, error, 'Failed to add favourite');
    return toFavourite(row as FavouriteRow);
  },

  async remove(userId, tradingMode, symbol) {
    const { error } = await getSupabase()
      .from('user_favourites')
      .delete()
      .eq('user_id', userId)
      .eq('trading_mode', tradingMode)
      .eq('symbol', symbol);
    if (error) throw new Error(`Failed to remove favourite: ${error.message}`);
  },
};

const feedback: IFeedbackRepository = {
  async listMine(userId) {
    const { data, error } = await getSupabase()
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const rows = unwrap(data, error, 'Failed to load your feedback') as FeedbackRow[];
    return rows.map(toFeedback);
  },

  async submit(userId, draft: FeedbackDraft) {
    const { data, error } = await getSupabase()
      .from('feedback')
      .insert({
        user_id: userId,
        type: draft.type,
        rating: draft.rating ?? null,
        message: draft.message,
        page: draft.page ?? null,
        app_version: draft.appVersion ?? null,
      })
      .select()
      .single();
    const row = unwrap(data, error, 'Failed to submit feedback');
    return toFeedback(row as FeedbackRow);
  },
};

const strategies: IStrategyRepository = {
  async list(userId) {
    const { data, error } = await getSupabase()
      .from('strategies')
      .select('*')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .order('name');
    const rows = unwrap(data, error, 'Failed to load strategies') as StrategyRow[];
    return rows.map(toStrategy);
  },

  async create(userId, input) {
    await assertCanCreateStrategy(userId);
    const { data, error } = await getSupabase()
      .from('strategies')
      .insert({
        id: uid(),
        user_id: userId,
        name: input.name,
        description: input.description ?? null,
        is_system: false,
        is_active: true,
      })
      .select()
      .single();
    const row = unwrap(data, error, 'Failed to create strategy');
    return toStrategy(row as StrategyRow);
  },

  async update(userId, id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { data, error } = await getSupabase()
      .from('strategies')
      .update(row)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update strategy');
    return toStrategy(updated as StrategyRow);
  },

  async remove(userId, id) {
    const { error } = await getSupabase()
      .from('strategies')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to delete strategy: ${error.message}`);
  },
};

/** Sensible opening daily loss limit, in the book's own currency. */
const DEFAULT_DAILY_LOSS_LIMIT: Record<TradingMode, number> = { forex: 1000, indian: 25_000 };

const risk: IRiskRepository = {
  async get(userId, tradingMode) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('risk_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('trading_mode', tradingMode)
      .maybeSingle();
    if (error && !data) throw new Error(`Failed to load risk settings: ${error.message}`);
    if (data) return toRisk(data as RiskRow);

    // Self-heal: a user who predates per-mode risk settings gets the missing
    // book's row on first read rather than an error.
    const { data: created, error: cErr } = await sb
      .from('risk_settings')
      .insert({
        user_id: userId,
        trading_mode: tradingMode,
        daily_loss_limit: DEFAULT_DAILY_LOSS_LIMIT[tradingMode],
      })
      .select()
      .single();
    const row = unwrap(created, cErr, 'Failed to create risk settings');
    return toRisk(row as RiskRow);
  },

  async update(userId, tradingMode, patch) {
    await risk.get(userId, tradingMode); // ensure the row exists before updating
    const row: Record<string, number> = {};
    if (patch.riskPerTradePct !== undefined) row.risk_per_trade_pct = patch.riskPerTradePct;
    if (patch.dailyLossLimit !== undefined) row.daily_loss_limit = patch.dailyLossLimit;
    if (patch.maxDrawdownPct !== undefined) row.max_drawdown_pct = patch.maxDrawdownPct;
    if (patch.maxPositionPct !== undefined) row.max_position_pct = patch.maxPositionPct;
    const { data, error } = await getSupabase()
      .from('risk_settings')
      .update(row)
      .eq('user_id', userId)
      .eq('trading_mode', tradingMode)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update risk settings');
    return toRisk(updated as RiskRow);
  },
};

const content: IContentRepository = {
  async get() {
    // Public catalogue row, like `plans` and `instruments`. A failure here must
    // never blank the marketing site, so fall back to the bundled defaults.
    const { data, error } = await getSupabase()
      .from('site_content')
      .select('*')
      .eq('id', 'site')
      .maybeSingle();
    if (error || !data) return DEFAULT_CONTENT;
    return toSiteContent(data as SiteContentRow);
  },
};

const plans: IPlanRepository = {
  async list() {
    const { data, error } = await getSupabase().from('plans').select('*').order('sort_order');
    const rows = unwrap(data, error, 'Failed to load plans') as PlanRow[];
    return rows.map(toPlan);
  },

  async update(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.billingPeriod !== undefined) row.billing_period = patch.billingPeriod;
    if (patch.currency !== undefined) row.currency = patch.currency;
    if (patch.features !== undefined) row.features = patch.features;
    if (patch.limits !== undefined) row.limits = patch.limits;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { data, error } = await getSupabase()
      .from('plans')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update plan');
    return toPlan(updated as PlanRow);
  },
};

const admin: IAdminRepository = {
  async overview() {
    const { data, error } = await getSupabase().rpc('admin_overview_stats');
    if (error) throw new Error(`Failed to load overview: ${error.message}`);
    return data as AdminOverviewStats;
  },

  async signupSeries(days = 30) {
    const { data, error } = await getSupabase().rpc('admin_signup_series', { p_days: days });
    if (error) throw new Error(`Failed to load signups: ${error.message}`);
    return ((data ?? []) as { day: string; signups: number }[]).map((r) => ({
      day: r.day,
      signups: Number(r.signups),
    }));
  },

  async userRows() {
    const sb = getSupabase();
    // Three reads joined on the client: profiles and subscriptions are ordinary
    // tables, but trade activity comes from an RPC that returns counts only —
    // there is no way to get trade DETAIL through this path.
    const [profileRes, subRes, planRes, statRes] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('subscriptions').select('*'),
      sb.from('plans').select('*'),
      sb.rpc('admin_user_stats'),
    ]);

    const profiles = unwrap(profileRes.data, profileRes.error, 'Failed to load users') as (ProfileRow & {
      is_suspended?: boolean;
      suspended_reason?: string | null;
      last_active_at?: string | null;
    })[];
    const subs = ((subRes.data ?? []) as SubscriptionRow[]).map(toSubscription);
    const allPlans = ((planRes.data ?? []) as PlanRow[]).map(toPlan);
    const stats = (statRes.data ?? []) as {
      user_id: string;
      trade_count: number;
      last_trade_at: string | null;
    }[];

    const subByUser = new Map(subs.map((s) => [s.userId, s]));
    const planById = new Map(allPlans.map((p) => [p.id, p]));
    const statByUser = new Map(stats.map((s) => [s.user_id, s]));

    return profiles.map((p): AdminUserRow => {
      const sub = subByUser.get(p.id);
      const plan = sub ? planById.get(sub.planId) : undefined;
      const stat = statByUser.get(p.id);
      return {
        id: p.id,
        email: p.email,
        displayName: p.display_name,
        phone: p.phone ?? undefined,
        role: p.role === 'admin' ? 'admin' : 'user',
        isSuspended: p.is_suspended ?? false,
        suspendedReason: p.suspended_reason ?? undefined,
        createdAt: p.created_at,
        lastActiveAt: p.last_active_at ?? undefined,
        planName: plan?.name,
        planCode: plan?.code,
        subscriptionStatus: sub?.status,
        tradeCount: Number(stat?.trade_count ?? 0),
        lastTradeAt: stat?.last_trade_at ?? undefined,
      };
    });
  },

  async setUserRole(userId, role) {
    const { error } = await getSupabase().rpc('admin_set_user_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (error) throw new Error(error.message);
  },

  async setUserSuspended(userId, suspended, reason) {
    const { error } = await getSupabase().rpc('admin_set_user_suspended', {
      p_user_id: userId,
      p_suspended: suspended,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async setSubscription(userId, planId, status = 'active', months = 1) {
    const { error } = await getSupabase().rpc('admin_set_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_status: status,
      p_months: months,
    });
    if (error) throw new Error(error.message);
  },

  async updateInstrument(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.lotSize !== undefined) row.lot_size = patch.lotSize;
    if (patch.contractSize !== undefined) row.contract_size = patch.contractSize;
    if (patch.tickSize !== undefined) row.tick_size = patch.tickSize;
    if (patch.pipSize !== undefined) row.pip_size = patch.pipSize;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;

    const sb = getSupabase();
    const { data, error } = await sb
      .from('instruments')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update instrument');

    await sb.rpc('log_admin_action', {
      p_action: 'update_instrument',
      p_target_type: 'instrument',
      p_target_id: id,
      p_before: null,
      p_after: row,
    });

    return toInstrument(updated as InstrumentRow);
  },

  async updateContent(patch) {
    // One SECURITY DEFINER call rather than an update plus a separate audit
    // write: it re-checks is_admin() and logs the change in the same statement,
    // so a published edit can never end up unaudited.
    const { data, error } = await getSupabase().rpc('admin_update_content', {
      p_announcement: patch.announcement ?? null,
      p_marketing: patch.marketing ?? null,
      p_faqs: patch.faqs ?? null,
    });
    if (error) throw new Error(`Failed to update site content: ${error.message}`);
    return toSiteContent(data as SiteContentRow);
  },

  async auditLog(limit = 200) {
    const { data, error } = await getSupabase()
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = unwrap(data, error, 'Failed to load the audit log') as {
      id: string;
      actor_id: string | null;
      actor_email: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      created_at: string;
    }[];
    return rows.map(
      (r): AuditEntry => ({
        id: r.id,
        actorId: r.actor_id,
        actorEmail: r.actor_email ?? undefined,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id ?? undefined,
        before: r.before ?? undefined,
        after: r.after ?? undefined,
        createdAt: r.created_at,
      }),
    );
  },

  async subscriptions() {
    const { data, error } = await getSupabase().from('subscriptions').select('*');
    const rows = unwrap(data, error, 'Failed to load subscriptions') as SubscriptionRow[];
    return rows.map(toSubscription);
  },

  async feedback() {
    const sb = getSupabase();
    // Two reads rather than an embedded join: `feedback.user_id` references
    // auth.users, so PostgREST cannot infer a relationship to `profiles`.
    const [fbRes, profileRes] = await Promise.all([
      sb.from('feedback').select('*').order('created_at', { ascending: false }),
      sb.from('profiles').select('id, display_name, email'),
    ]);
    const rows = unwrap(fbRes.data, fbRes.error, 'Failed to load feedback') as FeedbackRow[];
    const byId = new Map(
      ((profileRes.data ?? []) as Pick<ProfileRow, 'id' | 'display_name' | 'email'>[]).map((p) => [
        p.id,
        p,
      ]),
    );
    return rows.map((r): FeedbackWithAuthor => {
      const author = r.user_id ? byId.get(r.user_id) : undefined;
      return {
        ...toFeedback(r),
        authorName: author?.display_name,
        authorEmail: author?.email,
      };
    });
  },

  async updateFeedback(id, patch: FeedbackPatch) {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
    const { data, error } = await getSupabase()
      .from('feedback')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update feedback');
    return toFeedback(updated as FeedbackRow);
  },
};

const billing: IBillingRepository = {
  async getSubscription(userId) {
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    const row = unwrap(data, error, 'Failed to load subscription');
    return row ? toSubscription(row as SubscriptionRow) : null;
  },

  async tradeCount(userId) {
    const { count, error } = await getSupabase()
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to count trades: ${error.message}`);
    return count ?? 0;
  },

  async subscribe(userId, planId) {
    const sb = getSupabase();
    const { data: planData, error: planError } = await sb
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
    const planRow = unwrap(planData, planError, 'Plan not found') as PlanRow;

    const now = new Date();
    const end = new Date(now);
    if (planRow.billing_period === 'yearly') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    const status = planRow.code === 'FREE' ? 'free' : 'active';

    const { data, error } = await sb
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          status,
          current_period_start: now.toISOString(),
          current_period_end: planRow.code === 'FREE' ? null : end.toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();
    const updated = unwrap(data, error, 'Failed to update subscription');
    return toSubscription(updated as SubscriptionRow);
  },

  async cancel(userId) {
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .select()
      .single();
    const updated = unwrap(data, error, 'No subscription found');
    return toSubscription(updated as SubscriptionRow);
  },
};

export { requireUserId };

export const supabaseApi: Api = {
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
