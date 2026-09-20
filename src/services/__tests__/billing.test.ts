import { beforeEach, describe, expect, it } from 'vitest';
import { localApi, resetLocalData } from '../local';
import { DEMO_USER_ID } from '../seed';

/**
 * Checkout rules. These mirror the guards in `confirm_payment_order`, so the
 * local repository and the database enforce the same contract — a difference
 * between them is how a bug reaches production having passed in dev.
 */

const PRO_MONTHLY = 'plan-pro-monthly';
const ELITE_YEARLY = 'plan-elite-yearly';
const FREE = 'plan-free';

const OTHER_USER = 'admin-user';

beforeEach(() => {
  localStorage.clear();
  resetLocalData();
});

describe('creating an order', () => {
  it('prices the order from the plan, not from the caller', async () => {
    const plans = await localApi.plans.list();
    const pro = plans.find((p) => p.id === PRO_MONTHLY)!;

    const order = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);

    expect(order.amount).toBe(pro.price);
    expect(order.currency).toBe(pro.currency);
  });

  it('opens as pending, granting nothing', async () => {
    const before = await localApi.billing.getSubscription(DEMO_USER_ID);
    const order = await localApi.billing.createOrder(DEMO_USER_ID, ELITE_YEARLY);
    const after = await localApi.billing.getSubscription(DEMO_USER_ID);

    expect(order.status).toBe('created');
    // Creating an order must never move the user onto the plan.
    expect(after?.planId).toBe(before?.planId);
  });

  it('refuses the free plan — that is a cancellation, not a purchase', async () => {
    await expect(localApi.billing.createOrder(DEMO_USER_ID, FREE)).rejects.toThrow(
      /free plan does not require payment/i,
    );
  });

  it('refuses an unknown plan', async () => {
    await expect(localApi.billing.createOrder(DEMO_USER_ID, 'plan-nope')).rejects.toThrow(
      /not available/i,
    );
  });
});

describe('confirming a payment', () => {
  it('activates the plan and settles the order', async () => {
    const order = await localApi.billing.createOrder(DEMO_USER_ID, ELITE_YEARLY);
    const { order: settled, subscription } = await localApi.billing.confirmPayment(
      DEMO_USER_ID,
      order.id,
      { paymentId: 'pay_test_1' },
    );

    expect(settled.status).toBe('paid');
    expect(settled.providerPaymentId).toBe('pay_test_1');
    expect(settled.paidAt).toBeTruthy();
    expect(subscription.planId).toBe(ELITE_YEARLY);
    expect(subscription.status).toBe('active');
  });

  it('dates a yearly plan a year out and a monthly one a month out', async () => {
    const yearly = await localApi.billing.createOrder(DEMO_USER_ID, ELITE_YEARLY);
    const { subscription } = await localApi.billing.confirmPayment(DEMO_USER_ID, yearly.id, {
      paymentId: 'pay_y',
    });
    const end = new Date(subscription.currentPeriodEnd!);
    const start = new Date(subscription.currentPeriodStart!);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    expect(months).toBe(12);

    const monthly = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);
    const { subscription: sub2 } = await localApi.billing.confirmPayment(DEMO_USER_ID, monthly.id, {
      paymentId: 'pay_m',
    });
    const end2 = new Date(sub2.currentPeriodEnd!);
    const start2 = new Date(sub2.currentPeriodStart!);
    const months2 =
      (end2.getFullYear() - start2.getFullYear()) * 12 + (end2.getMonth() - start2.getMonth());
    expect(months2).toBe(1);
  });

  it('cannot be replayed to extend a subscription', async () => {
    const order = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);
    await localApi.billing.confirmPayment(DEMO_USER_ID, order.id, { paymentId: 'pay_once' });

    await expect(
      localApi.billing.confirmPayment(DEMO_USER_ID, order.id, { paymentId: 'pay_once' }),
    ).rejects.toThrow(/already been paid/i);
  });

  it('cannot be settled by anyone but the order owner', async () => {
    const order = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);

    await expect(
      localApi.billing.confirmPayment(OTHER_USER, order.id, { paymentId: 'pay_theft' }),
    ).rejects.toThrow(/not found/i);
  });

  it('cannot settle an order that already failed', async () => {
    const order = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);
    await localApi.billing.failOrder(DEMO_USER_ID, order.id, 'Declined.');

    await expect(
      localApi.billing.confirmPayment(DEMO_USER_ID, order.id, { paymentId: 'pay_late' }),
    ).rejects.toThrow(/no longer be paid/i);
  });
});

describe('failed and abandoned orders', () => {
  it('records the reason and leaves the plan untouched', async () => {
    const before = await localApi.billing.getSubscription(DEMO_USER_ID);
    const order = await localApi.billing.createOrder(DEMO_USER_ID, ELITE_YEARLY);
    const failed = await localApi.billing.failOrder(DEMO_USER_ID, order.id, 'Card declined.');
    const after = await localApi.billing.getSubscription(DEMO_USER_ID);

    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('Card declined.');
    expect(after?.planId).toBe(before?.planId);
  });
});

describe('history and cancellation', () => {
  it('lists the user\'s own orders, newest first', async () => {
    const first = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);
    await localApi.billing.failOrder(DEMO_USER_ID, first.id, 'Abandoned.');
    await localApi.billing.createOrder(DEMO_USER_ID, ELITE_YEARLY);

    const orders = await localApi.billing.orders(DEMO_USER_ID);
    expect(orders).toHaveLength(2);
    expect(orders[0]!.planId).toBe(ELITE_YEARLY);
  });

  it('does not leak another user\'s orders', async () => {
    await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);
    expect(await localApi.billing.orders(OTHER_USER)).toHaveLength(0);
  });

  it('cancels without deleting the subscription row', async () => {
    const order = await localApi.billing.createOrder(DEMO_USER_ID, PRO_MONTHLY);
    await localApi.billing.confirmPayment(DEMO_USER_ID, order.id, { paymentId: 'pay_c' });

    const cancelled = await localApi.billing.cancel(DEMO_USER_ID);
    expect(cancelled.status).toBe('canceled');
    // The period end survives, so access runs to the end of what was paid for.
    expect(cancelled.currentPeriodEnd).toBeTruthy();
  });
});
