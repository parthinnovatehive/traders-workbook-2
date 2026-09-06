import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { getEntitlements, type Entitlements } from '@/lib/entitlements';
import type { Feature } from '@/types';
import { canAccessFeature } from '@/lib/entitlements';
import { useAuthStore } from '@/store/authStore';
import { usePlans } from './usePlans';
import { useTrades } from './useTrades';

export function useSubscription() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => api.billing.getSubscription(user!.id),
    enabled: Boolean(user),
  });
}

/** Combined entitlements for the current user (plan, limit, usage, access). */
export function useEntitlements(): { entitlements: Entitlements; isLoading: boolean } {
  const subscription = useSubscription();
  const plans = usePlans();
  const trades = useTrades();
  const tradesUsed = trades.data?.length ?? 0;

  const entitlements = useMemo(
    () => getEntitlements(subscription.data ?? null, plans.data ?? [], tradesUsed),
    [subscription.data, plans.data, tradesUsed],
  );

  return {
    entitlements,
    isLoading: subscription.isLoading || plans.isLoading || trades.isLoading,
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
