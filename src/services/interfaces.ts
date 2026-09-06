import type {
  Plan,
  RiskSetting,
  Strategy,
  Subscription,
  Trade,
  TradeDraft,
  User,
} from '@/types';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  baseCurrency: string;
  startingCapital: number;
}

export type ProfilePatch = Partial<Pick<User, 'displayName' | 'baseCurrency' | 'startingCapital'>>;

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  login(email: string, password: string): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<User>;
}

export interface ITradeRepository {
  list(userId: string): Promise<Trade[]>;
  get(userId: string, id: string): Promise<Trade | null>;
  create(userId: string, draft: TradeDraft): Promise<Trade>;
  update(userId: string, id: string, patch: Partial<TradeDraft>): Promise<Trade>;
  remove(userId: string, id: string): Promise<void>;
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

export interface IRiskRepository {
  get(userId: string): Promise<RiskSetting>;
  update(userId: string, patch: Partial<Omit<RiskSetting, 'id' | 'userId'>>): Promise<RiskSetting>;
}

export interface IPlanRepository {
  list(): Promise<Plan[]>;
  update(id: string, patch: Partial<Omit<Plan, 'id' | 'code'>>): Promise<Plan>;
}

export interface IAdminRepository {
  users(): Promise<User[]>;
  subscriptions(): Promise<Subscription[]>;
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
