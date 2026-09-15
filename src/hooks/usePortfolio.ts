import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { filterTradesByRange, useDateFilter } from './useDateFilter';
import { useTradingAccount } from './useTradingAccounts';
import { useTrades } from './useTrades';

/**
 * Everything a section page needs: the user, the ACTIVE mode's funded account,
 * the trades belonging to that mode, and the date-filtered subset.
 *
 * `currency` and `startingCapital` come from the mode's own trading account, so
 * switching to Indian renders every figure in rupees against the Indian capital
 * base — a Forex number can never be shown with the Indian capital, or vice
 * versa, because no page reads a single account-wide value any more.
 */
export function usePortfolio() {
  const user = useAuthStore((s) => s.user);
  const tradingMode = useUiStore((s) => s.tradingMode);
  const tradesQuery = useTrades();
  const account = useTradingAccount(tradingMode);
  const { range } = useDateFilter();

  // Trades are partitioned strictly by mode. `trading_mode` is NOT NULL since
  // the Phase 1 backfill, so there is no "belongs to both" fallback: a legacy
  // trade used to be counted in Forex AND Indian, double-counting its P&L.
  const all = useMemo(
    () => (tradesQuery.data ?? []).filter((t) => t.tradingMode === tradingMode),
    [tradesQuery.data, tradingMode],
  );
  const filtered = useMemo(() => filterTradesByRange(all, range), [all, range]);

  return {
    user,
    tradingMode,
    account: account.account,
    startingCapital: account.startingCapital,
    currency: account.currency,
    all,
    filtered,
    range,
    isLoading: tradesQuery.isLoading || account.isLoading,
    isError: tradesQuery.isError || account.isError,
  };
}
