import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trade, TradeDraft } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';

export function useTrades() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['trades', user?.id],
    queryFn: () => api.trades.list(user!.id),
    enabled: Boolean(user),
  });
}

export function useCreateTrade() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: TradeDraft) => api.trades.create(user!.id, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades', user?.id] }),
  });
}

export function useUpdateTrade() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TradeDraft> }) =>
      api.trades.update(user!.id, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades', user?.id] }),
  });
}

export function useDeleteTrade() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.trades.remove(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades', user?.id] }),
  });
}

export type { Trade };
