import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { getEntitlements, type Entitlements } from '@/lib/entitlements';
import type { Feature, PaymentResult } from '@/types';
import { canAccessFeature } from '@/lib/entitlements';
import { useAuthStore } from '@/store/authStore';
import { usePlans } from './usePlans';
import { useTradeCount } from './useTrades';

export function useSubscription() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => api.billing.getSubscription(user!.id),
    enabled: Boolean(user),
  });
}

/**
 * Combined entitlements for the current user (plan, limit, usage, access).
 *
 * Usage comes from a server-side COUNT across both books, never from the length
 * of a loaded list: `useTrades()` is scoped to the active mode, so counting it
 * would hand a free user a fresh 30 trades per book.
 */
export function useEntitlements(): { entitlements: Entitlements; isLoading: boolean } {
  const subscription = useSubscription();
  const plans = usePlans();
  const tradeCount = useTradeCount();
  const tradesUsed = tradeCount.data ?? 0;

  const entitlements = useMemo(
    () => getEntitlements(subscription.data ?? null, plans.data ?? [], tradesUsed),
    [subscription.data, plans.data, tradesUsed],
  );

  return {
    entitlements,
    isLoading: subscription.isLoading || plans.isLoading || tradeCount.isLoading,
  };
}

/** Whether the current user can access a gated feature. */
export function useFeature(feature: Feature): boolean {
  const subscription = useSubscription();
  const plans = usePlans();
  return useMemo(
    () => canAccessFeature(feature, subscription.data ?? null, plans.data ?? []),
    [feature, subscription.data, plans.data],
  );
}

/** The user's own payment history. */
export function useOrders() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => api.billing.orders(user!.id),
    enabled: Boolean(user),
  });
}

/** Everything a plan change could affect. */
function useBillingInvalidation() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['subscription', user?.id] });
    void qc.invalidateQueries({ queryKey: ['orders', user?.id] });
  };
}

/**
 * Step 1 of checkout: open an order. Creates nothing but a pending row — the
 * plan is not granted until the payment is confirmed.
 */
export function useCreateOrder() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (planId: string) => api.billing.createOrder(user!.id, planId),
    onSuccess: invalidate,
  });
}

/** Step 2: submit the gateway receipt. The server activates the plan, not us. */
export function useConfirmPayment() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({ orderId, result }: { orderId: string; result: PaymentResult }) =>
      api.billing.confirmPayment(user!.id, orderId, result),
    onSuccess: invalidate,
  });
}

/** Records an abandoned or declined payment so the order isn't left pending. */
export function useFailOrder() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.billing.failOrder(user!.id, orderId, reason),
    onSuccess: invalidate,
  });
}

export function useCancelSubscription() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: () => api.billing.cancel(user!.id),
    onSuccess: invalidate,
  });
}
