import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trade, TradeDraft, TradingMode } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

/**
 * The trades for one book — defaults to the mode currently selected in the UI.
 *
 * The mode filter is applied SERVER-SIDE. Every page works inside exactly one
 * trading mode, so fetching the other book only to filter it out on arrival is
 * payload that grows with the user's history for no benefit. Date filtering
 * stays on the client, where `exitDate ?? entryDate` matches the engine.
 */
export function useTrades(mode?: TradingMode) {
  const user = useAuthStore((s) => s.user);
  const activeMode = useUiStore((s) => s.tradingMode);
  const tradingMode = mode ?? activeMode;

  return useQuery({
    queryKey: ['trades', user?.id, tradingMode],
    queryFn: () => api.trades.list(user!.id, { tradingMode }),
    enabled: Boolean(user),
  });
}

/**
 * Every trade across BOTH books, unfiltered.
 *
 * Only for "take all my data with you" paths (the account export). Pages must
 * use `useTrades()` so a Forex figure can never be computed from Indian rows.
 */
export function useAllTrades(enabled = true) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['trades', user?.id, 'all'],
    queryFn: () => api.trades.list(user!.id),
    enabled: Boolean(user) && enabled,
  });
}

/**
 * How many trades the user has recorded across BOTH books.
 *
 * This is the trade-limit denominator, so it must never be derived from a
 * mode-scoped list — counting only the active book would silently double a free
 * user's allowance. Served by a server-side COUNT, not by loading rows.
 */
export function useTradeCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['trade-count', user?.id],
    queryFn: () => api.trades.count(user!.id),
    enabled: Boolean(user),
  });
}

/** Invalidates every mode's list plus the count — a write can affect all of them. */
function useTradeInvalidation() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['trades', user?.id] });
    void qc.invalidateQueries({ queryKey: ['trade-count', user?.id] });
  };
}

export function useCreateTrade() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useTradeInvalidation();
  return useMutation({
    mutationFn: (draft: TradeDraft) => api.trades.create(user!.id, draft),
    onSuccess: invalidate,
  });
}

export function useUpdateTrade() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useTradeInvalidation();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TradeDraft> }) =>
      api.trades.update(user!.id, id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteTrade() {
  const user = useAuthStore((s) => s.user);
  const invalidate = useTradeInvalidation();
  return useMutation({
    mutationFn: (id: string) => api.trades.remove(user!.id, id),
    onSuccess: invalidate,
  });
}

export type { Trade };
