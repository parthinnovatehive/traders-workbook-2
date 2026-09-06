import { useMemo } from 'react';
import type { Trade } from '@/types';
import { type DateRange, isWithin, resolvePreset } from '@/utils/date';
import { useUiStore } from '@/store/uiStore';

/** The active global date filter, resolved to a concrete range. */
export function useDateFilter() {
  const datePreset = useUiStore((s) => s.datePreset);
  const customRange = useUiStore((s) => s.customRange);
  const setDatePreset = useUiStore((s) => s.setDatePreset);
  const setCustomRange = useUiStore((s) => s.setCustomRange);

  const range = useMemo<DateRange>(
    () => resolvePreset(datePreset, customRange),
    [datePreset, customRange],
  );

  return { preset: datePreset, range, setDatePreset, setCustomRange };
}

/** Filter trades by a date range (using realization date, falling back to entry). */
export function filterTradesByRange(trades: readonly Trade[], range: DateRange): Trade[] {
  if (!range.start && !range.end) return [...trades];
  return trades.filter((t) => isWithin(t.exitDate ?? t.entryDate, range));
}
