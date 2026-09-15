import { beforeEach, describe, expect, it } from 'vitest';
import { localApi, resetLocalData } from '../local';
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID } from '../seed';

/**
 * Covers the Phase 1 additions to the local repository. The local data source is
 * the default for `npm run dev`, so a regression here breaks every developer
 * before it ever reaches Supabase.
 */

const registerInput = {
  email: 'new.trader@example.com',
  password: 'correct horse battery',
  displayName: 'New Trader',
  forexCurrency: 'GBP',
  forexStartingCapital: 25_000,
  indianStartingCapital: 750_000,
};

beforeEach(() => {
  localStorage.clear();
  resetLocalData();
});

describe('trading accounts', () => {
  it('seeds the demo user with a Forex and an Indian account', async () => {
    const accounts = await localApi.accounts.list(DEMO_USER_ID);

    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.tradingMode).toSorted()).toEqual(['forex', 'indian']);
  });

  it('denominates the Indian account in INR', async () => {
    const accounts = await localApi.accounts.list(DEMO_USER_ID);
    const indian = accounts.find((a) => a.tradingMode === 'indian');

    expect(indian?.currency).toBe('INR');
  });

  it('keeps the two capital bases independent', async () => {
    const accounts = await localApi.accounts.list(DEMO_USER_ID);
    const forex = accounts.find((a) => a.tradingMode === 'forex');
    const indian = accounts.find((a) => a.tradingMode === 'indian');

    expect(forex?.startingCapital).not.toBe(indian?.startingCapital);
  });

  it('opens both accounts on registration, with the values the user chose', async () => {
    const user = await localApi.auth.register(registerInput);
    const accounts = await localApi.accounts.list(user!.id);

    expect(accounts.find((a) => a.tradingMode === 'forex')).toMatchObject({
      currency: 'GBP',
      startingCapital: 25_000,
    });
    expect(accounts.find((a) => a.tradingMode === 'indian')).toMatchObject({
      currency: 'INR',
      startingCapital: 750_000,
    });
  });

  it('updates one account without touching the other', async () => {
    await localApi.accounts.update(DEMO_USER_ID, 'indian', { startingCapital: 999 });
    const accounts = await localApi.accounts.list(DEMO_USER_ID);

    expect(accounts.find((a) => a.tradingMode === 'indian')?.startingCapital).toBe(999);
    expect(accounts.find((a) => a.tradingMode === 'forex')?.startingCapital).toBe(100_000);
  });

  it('refuses to move the Indian account off INR', async () => {
    const updated = await localApi.accounts.update(DEMO_USER_ID, 'indian', { currency: 'USD' });

    expect(updated.currency).toBe('INR');
  });

  it('backfills a missing account rather than returning a partial list', async () => {
    const user = await localApi.auth.register(registerInput);
    // Simulate data written before trading_accounts existed.
    const stored = JSON.parse(localStorage.getItem('twb.db.v1')!) as {
      tradingAccounts: { userId: string; tradingMode: string }[];
    };
    stored.tradingAccounts = stored.tradingAccounts.filter(
      (a) => !(a.userId === user!.id && a.tradingMode === 'indian'),
    );
    localStorage.setItem('twb.db.v1', JSON.stringify(stored));

    // Force a reload of the cached database.
    resetLocalData();
    const fresh = await localApi.accounts.list(DEMO_USER_ID);
    expect(fresh).toHaveLength(2);
  });
});

describe('instruments', () => {
  it('serves both modes and can filter to one', async () => {
    const all = await localApi.instruments.list();
    const indian = await localApi.instruments.list('indian');

    expect(all.length).toBeGreaterThan(indian.length);
    expect(indian.every((i) => i.tradingMode === 'indian')).toBe(true);
  });

  it('marks cash-only names with a lot size of 1 (quantity means shares)', async () => {
    const indian = await localApi.instruments.list('indian');
    const cashOnly = indian.filter((i) => !i.hasFno);

    expect(cashOnly.length).toBeGreaterThan(0);
    expect(cashOnly.every((i) => i.lotSize === 1)).toBe(true);
  });

  it('lists a dual-listed company once, with the other exchange in alsoOn', async () => {
    const indian = await localApi.instruments.list('indian');
    const reliance = indian.filter((i) => i.symbol === 'RELIANCE');

    expect(reliance).toHaveLength(1);
    expect(reliance[0]?.alsoOn).toContain('BSE');
  });

  it('gives every currency pair a 100,000-unit standard lot', async () => {
    const forex = await localApi.instruments.list('forex');
    const currencyPairs = forex.filter(
      (i) => i.category === 'major' || i.category === 'minor' || i.category === 'exotic',
    );

    expect(currencyPairs.length).toBeGreaterThan(0);
    expect(currencyPairs.every((i) => i.contractSize === 100_000)).toBe(true);
  });

  it('does not treat metals as 100,000-unit currency pairs', async () => {
    const forex = await localApi.instruments.list('forex');
    const gold = forex.find((i) => i.symbol === 'XAU/USD');

    expect(gold?.contractSize).toBe(100);
    expect(gold?.pipSize).toBe(0.01);
  });

  it('uses a 0.01 pip for JPY-quoted pairs and 0.0001 elsewhere', async () => {
    const forex = await localApi.instruments.list('forex');
    const usdJpy = forex.find((i) => i.symbol === 'USD/JPY');
    const eurUsd = forex.find((i) => i.symbol === 'EUR/USD');

    expect(usdJpy?.pipSize).toBe(0.01);
    expect(eurUsd?.pipSize).toBe(0.0001);
  });
});

describe('favourites', () => {
  it('keeps favourites separate per trading mode', async () => {
    await localApi.favourites.add(DEMO_USER_ID, 'forex', 'USD/CHF');
    const favourites = await localApi.favourites.list(DEMO_USER_ID);

    expect(favourites.some((f) => f.tradingMode === 'forex' && f.symbol === 'USD/CHF')).toBe(true);
    expect(favourites.some((f) => f.tradingMode === 'indian' && f.symbol === 'USD/CHF')).toBe(false);
  });

  it('keeps favourites separate per user', async () => {
    const user = await localApi.auth.register(registerInput);
    await localApi.favourites.add(user!.id, 'indian', 'INFY');

    const theirs = await localApi.favourites.list(user!.id);
    const demos = await localApi.favourites.list(DEMO_USER_ID);

    expect(theirs.map((f) => f.symbol)).toEqual(['INFY']);
    expect(demos.some((f) => f.symbol === 'INFY')).toBe(false);
  });

  it('is idempotent when starring the same symbol twice', async () => {
    await localApi.favourites.add(DEMO_USER_ID, 'forex', 'USD/CHF');
    await localApi.favourites.add(DEMO_USER_ID, 'forex', 'USD/CHF');
    const favourites = await localApi.favourites.list(DEMO_USER_ID);

    expect(favourites.filter((f) => f.symbol === 'USD/CHF')).toHaveLength(1);
  });

  it('removes only the starred symbol in that mode', async () => {
    await localApi.favourites.add(DEMO_USER_ID, 'indian', 'NIFTY');
    await localApi.favourites.remove(DEMO_USER_ID, 'indian', 'NIFTY');
    const favourites = await localApi.favourites.list(DEMO_USER_ID);

    expect(favourites.some((f) => f.tradingMode === 'indian' && f.symbol === 'NIFTY')).toBe(false);
    expect(favourites.some((f) => f.tradingMode === 'forex')).toBe(true);
  });
});

describe('feedback', () => {
  it('records a submission as new and returns it to its author', async () => {
    await localApi.feedback.submit(DEMO_USER_ID, {
      type: 'bug',
      message: 'Equity curve is empty after I delete a trade.',
      page: '/app',
    });
    const mine = await localApi.feedback.listMine(DEMO_USER_ID);

    expect(mine[0]).toMatchObject({ type: 'bug', status: 'new', page: '/app' });
  });

  it('does not leak one user\'s feedback to another', async () => {
    const user = await localApi.auth.register(registerInput);
    await localApi.feedback.submit(DEMO_USER_ID, { type: 'general', message: 'Private note.' });

    const theirs = await localApi.feedback.listMine(user!.id);
    expect(theirs).toHaveLength(0);
  });

  it('shows admins every submission with its author attached', async () => {
    const all = await localApi.admin.feedback();

    expect(all.length).toBeGreaterThan(0);
    expect(all[0]?.authorName).toBe('Demo Trader');
  });

  it('lets an admin triage a submission', async () => {
    const all = await localApi.admin.feedback();
    const first = all[0]!;
    const updated = await localApi.admin.updateFeedback(first.id, {
      status: 'resolved',
      adminNote: 'Shipped.',
    });

    expect(updated.status).toBe('resolved');
    expect(updated.adminNote).toBe('Shipped.');
  });
});

describe('auth', () => {
  it('signs in the seeded demo account', async () => {
    const user = await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(user.id).toBe(DEMO_USER_ID);
  });

  it('rejects a wrong password', async () => {
    await expect(localApi.auth.login(DEMO_EMAIL, 'nope')).rejects.toThrow(
      /invalid email or password/i,
    );
  });

  it('notifies subscribers when the session changes', async () => {
    const seen: (string | null)[] = [];
    const unsubscribe = localApi.auth.onAuthStateChange((u) => seen.push(u?.id ?? null));

    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.auth.logout();
    unsubscribe();

    expect(seen).toEqual([DEMO_USER_ID, null]);
  });
});
