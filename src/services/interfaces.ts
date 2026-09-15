import type {
  AdminOverviewStats,
  AdminUserRow,
  AuditEntry,
  Favourite,
  Feedback,
  FeedbackDraft,
  FeedbackPatch,
  FeedbackWithAuthor,
  Instrument,
  Plan,
  RiskSetting,
  RiskSettingPatch,
  SignupPoint,
  SiteContent,
  SiteContentPatch,
  Strategy,
  Subscription,
  Trade,
  TradeDraft,
  TradingAccount,
  TradingAccountPatch,
  TradingMode,
  User,
} from '@/types';

/** The fields an admin may correct on an instrument (lot sizes drift). */
export type InstrumentPatch = Partial<
  Pick<Instrument, 'lotSize' | 'contractSize' | 'tickSize' | 'pipSize' | 'isActive' | 'name'>
>;

/**
 * Registration now opens BOTH trading accounts up front: a Forex account in the
 * currency the trader picks, and an Indian account that is always INR.
 */
export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  forexCurrency: string;
  forexStartingCapital: number;
  indianStartingCapital: number;
}

export type ProfilePatch = Partial<Pick<User, 'displayName' | 'phone'>>;

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  login(email: string, password: string): Promise<User>;
  /**
   * Returns null when the project requires email confirmation — there is no
   * session until the user clicks the link, so the UI must say so rather than
   * navigating into the app.
   */
  register(input: RegisterInput): Promise<User | null>;
  logout(): Promise<void>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<User>;
  /** Emails a password-reset link. Never reveals whether the address exists. */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password for the user in the current (recovery) session. */
  updatePassword(newPassword: string): Promise<void>;
  /** Subscribe to sign-in/sign-out happening elsewhere (another tab, token expiry). */
  onAuthStateChange(handler: (user: User | null) => void): () => void;
  /** Marks the first-run wizard as done. Idempotent. */
  completeOnboarding(userId: string): Promise<User>;
}

/**
 * Server-side narrowing for `trades.list`.
 *
 * Every page works inside exactly one trading mode, so fetching the other
 * book's rows only to discard them client-side is wasted payload that grows
 * with the user's history. Date filtering deliberately stays on the client: the
 * realization date is `exitDate ?? entryDate`, and expressing that fallback as
 * a server-side range predicate would diverge from the engine's own definition.
 */
export interface TradeFilter {
  tradingMode?: TradingMode;
}

export interface ITradeRepository {
  list(userId: string, filter?: TradeFilter): Promise<Trade[]>;
  get(userId: string, id: string): Promise<Trade | null>;
  create(userId: string, draft: TradeDraft): Promise<Trade>;
  update(userId: string, id: string, patch: Partial<TradeDraft>): Promise<Trade>;
  remove(userId: string, id: string): Promise<void>;
  /** Total rows for this user across BOTH modes — the trade-limit denominator. */
  count(userId: string): Promise<number>;
}

export interface IStrategyRepository {
  list(userId: string): Promise<Strategy[]>;
  create(userId: string, input: { name: string; description?: string }): Promise<Strategy>;
  update(
    userId: string,
    id: string,
    patch: Partial<Pick<Strategy, 'name' | 'description' | 'isActive'>>,
  ): Promise<Strategy>;
  remove(userId: string, id: string): Promise<void>;
}

/**
 * Risk rules are per (user, trading mode) — a daily loss limit is an amount in
 * the mode's own currency, so one global row cannot express both books.
 */
export interface IRiskRepository {
  get(userId: string, tradingMode: TradingMode): Promise<RiskSetting>;
  update(
    userId: string,
    tradingMode: TradingMode,
    patch: RiskSettingPatch,
  ): Promise<RiskSetting>;
}

/** Editable marketing copy, FAQ and announcement banner. Public read. */
export interface IContentRepository {
  get(): Promise<SiteContent>;
}

export interface IPlanRepository {
  list(): Promise<Plan[]>;
  update(id: string, patch: Partial<Omit<Plan, 'id' | 'code'>>): Promise<Plan>;
}

/** Both of a user's funded accounts (Forex + Indian). */
export interface ITradingAccountRepository {
  list(userId: string): Promise<TradingAccount[]>;
  update(
    userId: string,
    tradingMode: TradingMode,
    patch: TradingAccountPatch,
  ): Promise<TradingAccount>;
}

/** The instrument master. Public catalogue — cached hard on the client. */
export interface IInstrumentRepository {
  list(tradingMode?: TradingMode): Promise<Instrument[]>;
}

export interface IFavouriteRepository {
  list(userId: string): Promise<Favourite[]>;
  add(userId: string, tradingMode: TradingMode, symbol: string): Promise<Favourite>;
  remove(userId: string, tradingMode: TradingMode, symbol: string): Promise<void>;
}

export interface IFeedbackRepository {
  /** The signed-in user's own submissions. */
  listMine(userId: string): Promise<Feedback[]>;
  submit(userId: string, draft: FeedbackDraft): Promise<Feedback>;
}

/**
 * Admin surface. Deliberately exposes NO trade data — not P&L, not positions,
 * not individual trades. Only counts and aggregates. RLS enforces this too:
 * there is no admin-read policy on `trades`, and the statistics come from
 * SECURITY DEFINER functions that return counts and dates only.
 */
export interface IAdminRepository {
  overview(): Promise<AdminOverviewStats>;
  signupSeries(days?: number): Promise<SignupPoint[]>;
  /** The user directory: profile + plan + trade COUNT. */
  userRows(): Promise<AdminUserRow[]>;
  setUserRole(userId: string, role: 'user' | 'admin'): Promise<void>;
  setUserSuspended(userId: string, suspended: boolean, reason?: string): Promise<void>;
  setSubscription(
    userId: string,
    planId: string,
    status?: string,
    months?: number,
  ): Promise<void>;
  subscriptions(): Promise<Subscription[]>;
  feedback(): Promise<FeedbackWithAuthor[]>;
  updateFeedback(id: string, patch: FeedbackPatch): Promise<Feedback>;
  /** Instrument master maintenance — how lot sizes get corrected without a deploy. */
  updateInstrument(id: string, patch: InstrumentPatch): Promise<Instrument>;
  /** Marketing copy, FAQ and the announcement banner — edited without a deploy. */
  updateContent(patch: SiteContentPatch): Promise<SiteContent>;
  auditLog(limit?: number): Promise<AuditEntry[]>;
}

export interface IBillingRepository {
  getSubscription(userId: string): Promise<Subscription | null>;
  /** Number of trades the user has recorded (source of truth for the limit). */
  tradeCount(userId: string): Promise<number>;
  subscribe(userId: string, planId: string): Promise<Subscription>;
  cancel(userId: string): Promise<Subscription>;
}

/** The full data-access surface. UI/hooks depend on this, never on an impl. */
export interface Api {
  auth: IAuthService;
  trades: ITradeRepository;
  strategies: IStrategyRepository;
  risk: IRiskRepository;
  plans: IPlanRepository;
  accounts: ITradingAccountRepository;
  instruments: IInstrumentRepository;
  favourites: IFavouriteRepository;
  feedback: IFeedbackRepository;
  content: IContentRepository;
  admin: IAdminRepository;
  billing: IBillingRepository;
}

/** Thrown by the repository when a free user exceeds the trade limit. */
export class TradeLimitError extends Error {
  readonly code = 'TRADE_LIMIT_REACHED';
  constructor(message = "You've reached your free trade limit.") {
    super(message);
    this.name = 'TradeLimitError';
  }
}

/** Thrown when a plan's custom-strategy allowance is already used up. */
export class StrategyLimitError extends Error {
  readonly code = 'STRATEGY_LIMIT_REACHED';
  constructor(limit: number) {
    super(
      `Your plan includes ${limit} custom ${limit === 1 ? 'strategy' : 'strategies'}. Upgrade to add more.`,
    );
    this.name = 'StrategyLimitError';
  }
}

/** Thrown when a sign-up succeeded but the email still needs confirming. */
export class EmailConfirmationRequiredError extends Error {
  readonly code = 'EMAIL_CONFIRMATION_REQUIRED';
  constructor(message = 'Check your inbox to confirm your email address.') {
    super(message);
    this.name = 'EmailConfirmationRequiredError';
  }
}
