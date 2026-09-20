import dayjs from 'dayjs';
import type {
  Favourite,
  Feedback,
  Instrument,
  Market,
  MistakeCode,
  PsychCode,
  Strategy,
  Trade,
  TradeDirection,
  TradingAccount,
} from '@/types';
import { DEFAULT_STRATEGIES } from '@/constants/strategies';
import { DEFAULT_CONTENT } from '@/config/content';
import { DEFAULT_PLANS } from '@/config/plans';
import {
  FOREX_SPECS,
  getForexSpec,
  LOT_UNITS,
  type LotType,
} from '@/constants/instruments';
import { getIndianSpec, INDIAN_INSTRUMENTS } from '@/constants/indianInstruments';
import { roundTo } from '@/utils/money';
import { calculateForexPipValue } from '@/calculations/forex';
import type { Database } from './db';
import { DB_VERSION, mockHash } from './db';
import { getFxProvider } from './fx';

export const DEMO_USER_ID = 'demo-user';
export const DEMO_EMAIL = 'demo@tradersworkbook.app';
export const DEMO_PASSWORD = 'demo1234';
export const ADMIN_EMAIL = 'admin@tradersworkbook.app';
export const ADMIN_PASSWORD = 'admin1234';
const STARTING_CAPITAL = 100_000;
const ACCOUNT_CCY = 'USD';
/** The Indian book keeps its own capital base, in rupees (request #5). */
const INDIAN_STARTING_CAPITAL = 500_000;

/** Deterministic PRNG so the demo data is stable within a session. */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length] as T;

const FX_INSTRUMENTS = [
  { pair: 'EUR/USD', px: 1.085 },
  { pair: 'GBP/USD', px: 1.265 },
  { pair: 'USD/JPY', px: 150.2 },
  { pair: 'GBP/JPY', px: 190.5 },
  { pair: 'EUR/GBP', px: 0.858 },
  { pair: 'AUD/USD', px: 0.66 },
  { pair: 'USD/CAD', px: 1.36 },
  { pair: 'EUR/JPY', px: 163.0 },
  { pair: 'NZD/USD', px: 0.61 },
  { pair: 'USD/CHF', px: 0.885 },
];

const IN_INSTRUMENTS = [
  { sym: 'NIFTY', px: 23500 },
  { sym: 'BANKNIFTY', px: 50500 },
  { sym: 'FINNIFTY', px: 23200 },
  { sym: 'MIDCPNIFTY', px: 12800 },
  { sym: 'RELIANCE', px: 2950 },
  { sym: 'HDFCBANK', px: 1680 },
  { sym: 'INFY', px: 1620 },
  { sym: 'TCS', px: 4050 },
];

const LOT_TYPES: LotType[] = ['standard', 'mini', 'micro'];
const LOSER_MISTAKES: MistakeCode[] = ['Revenge', 'FOMO', 'NoConfirmation', 'MovedSL', 'Overtrading', 'EarlyEntry'];
const LOSER_PSYCH: PsychCode[] = ['Fear', 'Greed', 'Revenge', 'FOMO'];
const WINNER_PSYCH: PsychCode[] = ['Discipline', 'Patience', 'Confidence'];
const SETUPS = ['Break & retest', 'Liquidity sweep', 'Trend continuation', 'Range reversal', 'Order block'];
const CONDITIONS = ['Trending', 'Ranging', 'Volatile', 'Quiet'];

function systemStrategies(): Strategy[] {
  return DEFAULT_STRATEGIES.map((s) => ({
    id: s.id,
    userId: null,
    name: s.name,
    description: s.description,
    isSystem: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  }));
}

function segmentMarket(sym: string): { market: Market; exchange: string; segment: string } {
  const spec = getIndianSpec(sym);
  if (!spec) return { market: 'Equity', exchange: 'NSE', segment: 'EQ' };
  const market: Market = spec.segment === 'INDEX' ? 'Index' : spec.segment === 'EQ' ? 'Equity' : 'Futures';
  return { market, exchange: spec.exchange, segment: spec.segment };
}

function generateTrades(): Trade[] {
  const rng = mulberry32(20260906);
  const fx = getFxProvider();
  const trades: Trade[] = [];
  let seq = 0;

  const makeBase = (mode: 'forex' | 'indian') => {
    seq += 1;
    const daysAgo = Math.floor(rng() * 120);
    const entryHour = 9 + Math.floor(rng() * 6);
    const entryMin = Math.floor(rng() * 60);
    const entryDay = dayjs().subtract(daysAgo, 'day');
    const exitHour = Math.min(entryHour + Math.floor(rng() * 3), 15);
    return {
      seq,
      entryDate: entryDay.format('YYYY-MM-DD'),
      entryTime: `${String(entryHour).padStart(2, '0')}:${String(entryMin).padStart(2, '0')}`,
      exitTime: `${String(exitHour).padStart(2, '0')}:${String((entryMin + 15) % 60).padStart(2, '0')}`,
      iso: entryDay.hour(entryHour).minute(entryMin).toISOString(),
      isOpen: rng() < 0.06,
      win: rng() < 0.57,
      strategyId: pick(rng, DEFAULT_STRATEGIES).id,
      mode,
    };
  };

  const tagsFor = (win: boolean): { psychology: PsychCode[]; mistakes: MistakeCode[] } => {
    const psychology: PsychCode[] = [];
    const mistakes: MistakeCode[] = [];
    if (win) {
      if (rng() < 0.4) psychology.push(pick(rng, WINNER_PSYCH));
    } else {
      if (rng() < 0.6) {
        mistakes.push(pick(rng, LOSER_MISTAKES));
        if (rng() < 0.3) mistakes.push('RuleViolation');
      }
      if (rng() < 0.5) psychology.push(pick(rng, LOSER_PSYCH));
    }
    return { psychology, mistakes };
  };

  // ---- Forex trades ----
  for (let i = 0; i < 30; i += 1) {
    const b = makeBase('forex');
    const inst = pick(rng, FX_INSTRUMENTS);
    const spec = getForexSpec(inst.pair)!;
    const lotType = pick(rng, LOT_TYPES);
    const unitsPerLot = LOT_UNITS[lotType];
    const direction: TradeDirection = rng() < 0.55 ? 'long' : 'short';
    const long = direction === 'long';

    const conversionRate = fx.getRate(spec.quote, ACCOUNT_CCY); // quote -> USD
    const stopPips = 15 + Math.floor(rng() * 45);
    const pipValuePerLot = spec.pipSize * unitsPerLot * conversionRate;
    const targetRisk = STARTING_CAPITAL * (0.003 + rng() * 0.005);
    const rawLots = targetRisk / (stopPips * pipValuePerLot);
    const lots = Math.min(Math.max(roundTo(Math.round(rawLots / 0.01) * 0.01, 2), 0.01), 8);

    const entry = roundTo(inst.px * (1 + (rng() - 0.5) * 0.01), spec.quote === 'JPY' ? 3 : 5);
    const stopDist = stopPips * spec.pipSize;
    const rr = 1.2 + rng() * 2.2;
    const stopLoss = roundTo(long ? entry - stopDist : entry + stopDist, spec.quote === 'JPY' ? 3 : 5);
    const target = roundTo(long ? entry + stopDist * rr : entry - stopDist * rr, spec.quote === 'JPY' ? 3 : 5);

    let exitPrice: number | null = null;
    let exitDate: string | undefined;
    let exitTime: string | undefined;
    if (!b.isOpen) {
      const frac = b.win ? Math.min(0.55 + rng() * 0.7, 1.1) * rr : -(0.7 + rng() * 0.5);
      exitPrice = roundTo(long ? entry + stopDist * frac : entry - stopDist * frac, spec.quote === 'JPY' ? 3 : 5);
      exitDate = b.entryDate;
      exitTime = b.exitTime;
    }
    const tags = tagsFor(b.win);
    const pipValue = calculateForexPipValue(spec.pipSize, lots * unitsPerLot, conversionRate) ?? undefined;

    trades.push({
      id: `fx-${b.seq}`,
      userId: DEMO_USER_ID,
      tradingMode: 'forex',
      entryDate: b.entryDate,
      entryTime: b.entryTime,
      exitDate,
      exitTime,
      symbol: spec.symbol,
      market: 'Forex',
      direction,
      baseCurrency: spec.base,
      quoteCurrency: spec.quote,
      lotType,
      accountCurrency: ACCOUNT_CCY,
      entryPrice: entry,
      exitPrice,
      quantity: lots,
      lotSize: unitsPerLot,
      stopLoss,
      target,
      charges: roundTo(2 + rng() * 6, 2),
      conversionRate: roundTo(conversionRate, 6),
      pipDistance: stopPips,
      pipValue,
      strategyId: b.strategyId,
      setup: pick(rng, SETUPS),
      marketCondition: pick(rng, CONDITIONS),
      notes: '',
      psychology: tags.psychology,
      mistakes: tags.mistakes,
      createdAt: b.iso,
      updatedAt: b.iso,
    });
  }

  // ---- Indian trades ----
  const inrToAccount = fx.getRate('INR', ACCOUNT_CCY);
  for (let i = 0; i < 28; i += 1) {
    const b = makeBase('indian');
    const inst = pick(rng, IN_INSTRUMENTS);
    const spec = getIndianSpec(inst.sym)!;
    const { market, exchange, segment } = segmentMarket(inst.sym);
    const direction: TradeDirection = rng() < 0.55 ? 'long' : 'short';
    const long = direction === 'long';
    const qty = 1 + Math.floor(rng() * 4); // lots

    const entry = roundTo(inst.px * (1 + (rng() - 0.5) * 0.02), 2);
    const stopDist = inst.px * (0.004 + rng() * 0.006);
    const rr = 1.2 + rng() * 2.2;
    const stopLoss = roundTo(long ? entry - stopDist : entry + stopDist, 2);
    const target = roundTo(long ? entry + stopDist * rr : entry - stopDist * rr, 2);

    let exitPrice: number | null = null;
    let exitDate: string | undefined;
    let exitTime: string | undefined;
    if (!b.isOpen) {
      const frac = b.win ? Math.min(0.55 + rng() * 0.7, 1.1) * rr : -(0.7 + rng() * 0.5);
      exitPrice = roundTo(long ? entry + stopDist * frac : entry - stopDist * frac, 2);
      exitDate = b.entryDate;
      exitTime = b.exitTime;
    }
    const tags = tagsFor(b.win);

    trades.push({
      id: `in-${b.seq}`,
      userId: DEMO_USER_ID,
      tradingMode: 'indian',
      entryDate: b.entryDate,
      entryTime: b.entryTime,
      exitDate,
      exitTime,
      symbol: spec.symbol,
      market,
      direction,
      quoteCurrency: 'INR',
      exchange,
      segment,
      accountCurrency: ACCOUNT_CCY,
      entryPrice: entry,
      exitPrice,
      quantity: qty,
      lotSize: spec.lotSize,
      stopLoss,
      target,
      charges: roundTo(1 + rng() * 5, 2),
      conversionRate: roundTo(inrToAccount, 6),
      strategyId: b.strategyId,
      setup: pick(rng, SETUPS),
      marketCondition: pick(rng, CONDITIONS),
      notes: '',
      psychology: tags.psychology,
      mistakes: tags.mistakes,
      createdAt: b.iso,
      updatedAt: b.iso,
    });
  }

  return trades;
}

/**
 * The local mirror of the `instruments` table seeded by
 * supabase/migrations/0003_phase1_seed_instruments.sql. Derived from the same
 * constants the app uses today, so local and Supabase modes agree.
 */
function seedInstruments(): Instrument[] {
  const forex: Instrument[] = FOREX_SPECS.map((spec, i) => ({
    id: `FX:${spec.symbol.replace('/', '')}`,
    tradingMode: 'forex',
    symbol: spec.symbol,
    name: spec.name,
    alsoOn: [],
    hasFno: false,
    baseCurrency: spec.base,
    quoteCurrency: spec.quote,
    contractSize: spec.contractSize,
    lotSize: spec.contractSize,
    pipSize: spec.pipSize,
    tickSize: spec.tickSize,
    category: spec.category,
    isActive: true,
    sortOrder: (i + 1) * 10,
  }));

  const indian: Instrument[] = INDIAN_INSTRUMENTS.map((spec, i) => ({
    id: `${spec.exchange}:${spec.symbol}`,
    tradingMode: 'indian',
    symbol: spec.symbol,
    name: spec.name,
    exchange: spec.exchange,
    alsoOn: spec.alsoOn,
    segment: spec.segment,
    hasFno: spec.hasFno,
    quoteCurrency: 'INR',
    contractSize: 1,
    lotSize: spec.lotSize,
    tickSize: spec.tickSize,
    category: spec.segment === 'INDEX' ? 'index' : spec.hasFno ? 'fno' : 'cash',
    isActive: true,
    sortOrder: (i + 1) * 10,
  }));

  return [...forex, ...indian];
}

function seedTradingAccounts(now: dayjs.Dayjs): TradingAccount[] {
  const iso = now.toISOString();
  const account = (
    userId: string,
    tradingMode: 'forex' | 'indian',
    currency: string,
    startingCapital: number,
  ): TradingAccount => ({
    id: `acct-${userId}-${tradingMode}`,
    userId,
    tradingMode,
    currency,
    startingCapital,
    createdAt: iso,
    updatedAt: iso,
  });

  return [
    account(DEMO_USER_ID, 'forex', ACCOUNT_CCY, STARTING_CAPITAL),
    account(DEMO_USER_ID, 'indian', 'INR', INDIAN_STARTING_CAPITAL),
    account('admin-user', 'forex', ACCOUNT_CCY, 0),
    account('admin-user', 'indian', 'INR', 0),
  ];
}

function seedFavourites(now: dayjs.Dayjs): Favourite[] {
  const iso = now.toISOString();
  const fav = (tradingMode: 'forex' | 'indian', symbol: string): Favourite => ({
    userId: DEMO_USER_ID,
    tradingMode,
    symbol,
    createdAt: iso,
  });
  return [
    fav('forex', 'EUR/USD'),
    fav('forex', 'GBP/JPY'),
    fav('indian', 'NIFTY'),
    fav('indian', 'BANKNIFTY'),
  ];
}

/** A couple of messages so the admin inbox isn't empty in local dev. */
function seedFeedback(now: dayjs.Dayjs): Feedback[] {
  return [
    {
      id: 'fb-1',
      userId: DEMO_USER_ID,
      type: 'feature',
      rating: 4,
      message: 'Would love to attach a chart screenshot to each trade.',
      page: '/app/journal',
      status: 'new',
      createdAt: now.subtract(2, 'day').toISOString(),
      updatedAt: now.subtract(2, 'day').toISOString(),
    },
    {
      id: 'fb-2',
      userId: DEMO_USER_ID,
      type: 'bug',
      rating: 3,
      message: 'Large numbers overflow the cards on the reports page.',
      page: '/app/reports',
      status: 'in_review',
      adminNote: 'Fixed by compact formatting in Phase 2.',
      createdAt: now.subtract(5, 'day').toISOString(),
      updatedAt: now.subtract(1, 'day').toISOString(),
    },
  ];
}

/** Build the full seeded database (demo user + admin + trades + plans). */
export function buildSeed(): Database {
  const now = dayjs();
  return {
    version: DB_VERSION,
    users: [
      {
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        displayName: 'Demo Trader',
        role: 'user',
        baseCurrency: ACCOUNT_CCY,
        startingCapital: STARTING_CAPITAL,
        createdAt: now.toISOString(),
        // Both demo accounts are already funded and full of trades, so the
        // first-run wizard would have nothing to ask them.
        onboardedAt: now.toISOString(),
      },
      {
        id: 'admin-user',
        email: ADMIN_EMAIL,
        displayName: 'Admin',
        role: 'admin',
        baseCurrency: ACCOUNT_CCY,
        startingCapital: 0,
        createdAt: now.toISOString(),
        onboardedAt: now.toISOString(),
      },
    ],
    credentials: [
      { userId: DEMO_USER_ID, email: DEMO_EMAIL, passwordHash: mockHash(DEMO_PASSWORD) },
      { userId: 'admin-user', email: ADMIN_EMAIL, passwordHash: mockHash(ADMIN_PASSWORD) },
    ],
    trades: generateTrades(),
    strategies: systemStrategies(),
    // One row per book. The limits differ because the currencies differ — that
    // is exactly why a single global row could not express them.
    riskSettings: [
      {
        id: 'risk-demo-forex',
        userId: DEMO_USER_ID,
        tradingMode: 'forex',
        riskPerTradePct: 1,
        dailyLossLimit: 3000,
        maxDrawdownPct: 15,
        maxPositionPct: 25,
      },
      {
        id: 'risk-demo-indian',
        userId: DEMO_USER_ID,
        tradingMode: 'indian',
        riskPerTradePct: 1,
        dailyLossLimit: 25_000,
        maxDrawdownPct: 15,
        maxPositionPct: 25,
      },
    ],
    plans: DEFAULT_PLANS.map((p) => ({ ...p })),
    subscriptions: [
      {
        id: 'sub-demo',
        userId: DEMO_USER_ID,
        planId: 'plan-pro-monthly',
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: now.add(1, 'month').toISOString(),
      },
    ],
    tradingAccounts: seedTradingAccounts(now),
    instruments: seedInstruments(),
    favourites: seedFavourites(now),
    feedback: seedFeedback(now),
    auditLog: [],
    paymentOrders: [],
    content: JSON.parse(JSON.stringify(DEFAULT_CONTENT)) as Database['content'],
  };
}
