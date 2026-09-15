import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useEntitlements } from './useBilling';

export function useStrategies() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['strategies', user?.id],
    queryFn: () => api.strategies.list(user!.id),
    enabled: Boolean(user),
  });
}

/**
 * How much of the plan's custom-strategy allowance is used. System strategies
 * ship with the app and never count against it.
 */
export function useStrategyAllowance() {
  const strategies = useStrategies();
  const { entitlements } = useEntitlements();

  return useMemo(() => {
    const used = (strategies.data ?? []).filter((s) => !s.isSystem).length;
    const limit = entitlements.strategyLimit;
    const unlimited = limit < 0;
    return {
      used,
      limit,
      unlimited,
      remaining: unlimited ? -1 : Math.max(0, limit - used),
      canCreate: unlimited || used < limit,
    };
  }, [strategies.data, entitlements.strategyLimit]);
}

export function useCreateStrategy() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api.strategies.create(user!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies', user?.id] }),
  });
}

export function useDeleteStrategy() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.strategies.remove(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies', user?.id] }),
  });
}
