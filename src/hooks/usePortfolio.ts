import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { filterTradesByRange, useDateFilter } from './useDateFilter';
import { useTrades } from './useTrades';

/**
 * Everything a section page needs: the user, the trades for the ACTIVE trading
 * mode, and the date-filtered subset. Filtering by mode here means the whole
 * dashboard/journal/analytics respect the Forex/Indian toggle from one place.
 */
export function usePortfolio() {
  const user = useAuthStore((s) => s.user);
  const tradingMode = useUiStore((s) => s.tradingMode);
  const tradesQuery = useTrades();
  const { range } = useDateFilter();

  const all = useMemo(
    () =>
      (tradesQuery.data ?? []).filter(
        (t) => t.tradingMode === undefined || t.tradingMode === tradingMode,
      ),
    [tradesQuery.data, tradingMode],
  );
  const filtered = useMemo(() => filterTradesByRange(all, range), [all, range]);

  return {
    user,
    tradingMode,
    startingCapital: user?.startingCapital ?? 0,
    currency: user?.baseCurrency ?? 'USD',
    all,
    filtered,
    range,
    isLoading: tradesQuery.isLoading,
    isError: tradesQuery.isError,
  };
}
