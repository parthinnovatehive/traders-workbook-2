import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { getEntitlements, type Entitlements } from '@/lib/entitlements';
import type { Feature } from '@/types';
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

export function useSubscribe() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => api.billing.subscribe(user!.id, planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription', user?.id] }),
  });
}

export function useCancelSubscription() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.billing.cancel(user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription', user?.id] }),
  });
}
