import { beforeEach, describe, expect, it } from 'vitest';
import { localApi, resetLocalData } from '../local';
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID } from '../seed';

const ADMIN_ID = 'admin-user';

beforeEach(() => {
  localStorage.clear();
  resetLocalData();
});

describe('admin never exposes trade data', () => {
  /**
   * The governing rule of the admin surface (client request #8). These assert
   * the SHAPE of what admins receive — if someone later adds P&L or symbols to
   * a row to make a dashboard nicer, these fail.
   */
  it('returns a trade count per user but no trade contents', async () => {
    const rows = await localApi.admin.userRows();
    const demo = rows.find((r) => r.id === DEMO_USER_ID)!;

    expect(demo.tradeCount).toBeGreaterThan(0);

    const keys = Object.keys(demo);
    for (const forbidden of ['trades', 'netPnl', 'pnl', 'symbol', 'entryPrice', 'positions']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('exposes only counts in the platform overview', async () => {
    const overview = await localApi.admin.overview();

    expect(overview.totalTrades).toBeGreaterThan(0);
    expect(Object.keys(overview)).not.toContain('netPnl');
    // Every value must be a number — no nested trade objects can slip through.
    expect(Object.values(overview).every((v) => typeof v === 'number')).toBe(true);
  });

  it('has no repository method that returns trades to an admin', () => {
    const methods = Object.keys(localApi.admin);

    expect(methods).not.toContain('trades');
    expect(methods).not.toContain('userTrades');
  });
});

describe('admin overview statistics', () => {
  it('counts users, admins and trading users', async () => {
    const overview = await localApi.admin.overview();

    expect(overview.totalUsers).toBe(2);
    expect(overview.adminUsers).toBe(1);
    expect(overview.tradingUsers).toBe(1);
  });

  it('counts feedback still awaiting a response', async () => {
    const overview = await localApi.admin.overview();
    expect(overview.openFeedback).toBeGreaterThan(0);
  });

  it('returns one signup point per requested day', async () => {
    const series = await localApi.admin.signupSeries(14);
    expect(series).toHaveLength(14);
  });
});

describe('user management', () => {
  it('promotes and demotes a user, recording both in the audit log', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD); // acts as the actor
    await localApi.admin.setUserRole(ADMIN_ID, 'user');

    const rows = await localApi.admin.userRows();
    expect(rows.find((r) => r.id === ADMIN_ID)?.role).toBe('user');

    const log = await localApi.admin.auditLog();
    expect(log[0]).toMatchObject({ action: 'set_role', targetType: 'user', targetId: ADMIN_ID });
    expect(log[0]?.before).toEqual({ role: 'admin' });
    expect(log[0]?.after).toEqual({ role: 'user' });
  });

  it('refuses to let an admin remove their own admin role', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);

    await expect(localApi.admin.setUserRole(DEMO_USER_ID, 'user')).rejects.toThrow(
      /your own admin role/i,
    );
  });

  it('suspends a user with a reason', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setUserSuspended(ADMIN_ID, true, 'Terms violation');

    const rows = await localApi.admin.userRows();
    const target = rows.find((r) => r.id === ADMIN_ID);
    expect(target?.isSuspended).toBe(true);
    expect(target?.suspendedReason).toBe('Terms violation');
  });

  it('clears the reason when the account is restored', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setUserSuspended(ADMIN_ID, true, 'Spam');
    await localApi.admin.setUserSuspended(ADMIN_ID, false);

    const rows = await localApi.admin.userRows();
    const target = rows.find((r) => r.id === ADMIN_ID);
    expect(target?.isSuspended).toBe(false);
    expect(target?.suspendedReason).toBeUndefined();
  });

  it('refuses to let an admin suspend themselves', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);

    await expect(localApi.admin.setUserSuspended(DEMO_USER_ID, true)).rejects.toThrow(
      /your own account/i,
    );
  });
});

describe('subscriptions', () => {
  it('grants a plan and sets the period', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setSubscription(ADMIN_ID, 'plan-pro-monthly', 'active', 3);

    const sub = await localApi.billing.getSubscription(ADMIN_ID);
    expect(sub).toMatchObject({ planId: 'plan-pro-monthly', status: 'active' });
    expect(sub?.currentPeriodEnd).toBeDefined();
  });

  it('leaves no end date on a non-renewing status', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setSubscription(DEMO_USER_ID, 'plan-free', 'canceled', 1);

    const sub = await localApi.billing.getSubscription(DEMO_USER_ID);
    expect(sub?.currentPeriodEnd).toBeUndefined();
  });

  it('records the change in the audit log', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setSubscription(ADMIN_ID, 'plan-pro-monthly', 'active', 1);

    const log = await localApi.admin.auditLog();
    expect(log[0]?.action).toBe('set_subscription');
  });
});

describe('instrument maintenance', () => {
  it('corrects a lot size without touching anything else', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    const updated = await localApi.admin.updateInstrument('NSE:NIFTY', { lotSize: 50 });

    expect(updated.lotSize).toBe(50);
    expect(updated.symbol).toBe('NIFTY');
  });

  it('surfaces the corrected lot size to traders immediately', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.updateInstrument('NSE:NIFTY', { lotSize: 50 });

    const instruments = await localApi.instruments.list('indian');
    expect(instruments.find((i) => i.symbol === 'NIFTY')?.lotSize).toBe(50);
  });

  it('can retire an instrument from the picker', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.updateInstrument('NSE:NIFTY', { isActive: false });

    const instruments = await localApi.instruments.list('indian');
    expect(instruments.some((i) => i.symbol === 'NIFTY')).toBe(false);
  });

  it('records the correction in the audit log', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.updateInstrument('NSE:NIFTY', { lotSize: 50 });

    const log = await localApi.admin.auditLog();
    expect(log[0]).toMatchObject({ action: 'update_instrument', targetId: 'NSE:NIFTY' });
  });
});

describe('audit log', () => {
  it('is newest first', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setUserRole(ADMIN_ID, 'user');
    await localApi.admin.updateInstrument('NSE:NIFTY', { lotSize: 50 });

    const log = await localApi.admin.auditLog();
    expect(log[0]?.action).toBe('update_instrument');
    expect(log[1]?.action).toBe('set_role');
  });

  it('attributes each entry to the acting admin', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.setUserRole(ADMIN_ID, 'user');

    const log = await localApi.admin.auditLog();
    expect(log[0]?.actorEmail).toBe(DEMO_EMAIL);
  });

  it('respects the limit', async () => {
    await localApi.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    await localApi.admin.updateInstrument('NSE:NIFTY', { lotSize: 50 });
    await localApi.admin.updateInstrument('NSE:NIFTY', { lotSize: 60 });

    expect(await localApi.admin.auditLog(1)).toHaveLength(1);
  });
});
