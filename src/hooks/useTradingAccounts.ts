import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TradingAccount, TradingAccountPatch, TradingMode } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

/** Both of the signed-in user's funded accounts (Forex + Indian). */
export function useTradingAccounts() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['trading-accounts', user?.id],
    queryFn: () => api.accounts.list(user!.id),
    enabled: Boolean(user),
  });
}

/**
 * The account for one trading mode — defaults to the mode currently selected in
 * the UI. This is the single place every page should get `currency` and
 * `startingCapital` from, so a Forex figure can never be rendered with the
 * Indian capital base (or in the wrong currency).
 */
export function useTradingAccount(mode?: TradingMode) {
  const activeMode = useUiStore((s) => s.tradingMode);
  const tradingMode = mode ?? activeMode;
  const query = useTradingAccounts();

  const account = useMemo<TradingAccount | undefined>(
    () => (query.data ?? []).find((a) => a.tradingMode === tradingMode),
    [query.data, tradingMode],
  );

  return {
    ...query,
    tradingMode,
    account,
    // Fall back to sane defaults while loading so no page renders "N/A" capital
    // or an empty currency code mid-flight.
    currency: account?.currency ?? (tradingMode === 'indian' ? 'INR' : 'USD'),
    startingCapital: account?.startingCapital ?? 0,
  };
}

export function useUpdateTradingAccount() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradingMode, patch }: { tradingMode: TradingMode; patch: TradingAccountPatch }) =>
      api.accounts.update(user!.id, tradingMode, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trading-accounts', user?.id] }),
  });
}
