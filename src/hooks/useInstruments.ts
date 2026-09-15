import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Favourite, Instrument, TradingMode } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

/**
 * The instrument master for one mode. This is a public catalogue that changes
 * a few times a year, so it is cached hard — re-fetching it on every mount
 * would be thousands of rows for nothing.
 */
export function useInstruments(mode?: TradingMode) {
  const activeMode = useUiStore((s) => s.tradingMode);
  const tradingMode = mode ?? activeMode;
  return useQuery({
    queryKey: ['instruments', tradingMode],
    queryFn: () => api.instruments.list(tradingMode),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/** The signed-in user's starred symbols. Favourites are per user AND per mode. */
export function useFavourites() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['favourites', user?.id],
    queryFn: () => api.favourites.list(user!.id),
    enabled: Boolean(user),
  });
}

export interface ToggleFavouriteInput {
  tradingMode: TradingMode;
  symbol: string;
  /** Current state — the mutation flips it. */
  isFavourite: boolean;
}

/**
 * Star / unstar a symbol, applied optimistically — a star that waits for a
 * round-trip feels broken.
 */
export function useToggleFavourite() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const key = ['favourites', user?.id];

  return useMutation<void, Error, ToggleFavouriteInput, { previous: Favourite[] }>({
    mutationFn: async ({ tradingMode, symbol, isFavourite }) => {
      if (isFavourite) await api.favourites.remove(user!.id, tradingMode, symbol);
      else await api.favourites.add(user!.id, tradingMode, symbol);
    },

    onMutate: async ({ tradingMode, symbol, isFavourite }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Favourite[]>(key) ?? [];
      const next = isFavourite
        ? previous.filter((f) => !(f.tradingMode === tradingMode && f.symbol === symbol))
        : [
            ...previous,
            {
              userId: user!.id,
              tradingMode,
              symbol,
              createdAt: new Date().toISOString(),
            },
          ];
      qc.setQueryData(key, next);
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },

    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export interface InstrumentOption extends Instrument {
  isFavourite: boolean;
}

/**
 * Instruments for the active mode with favourites hoisted to the top —
 * the ordering the trade-entry dropdown renders (request #4).
 */
export function useInstrumentOptions(mode?: TradingMode) {
  const activeMode = useUiStore((s) => s.tradingMode);
  const tradingMode = mode ?? activeMode;
  const instruments = useInstruments(tradingMode);
  const favourites = useFavourites();

  const options = useMemo<InstrumentOption[]>(() => {
    const starred = new Set(
      (favourites.data ?? [])
        .filter((f) => f.tradingMode === tradingMode)
        .map((f) => f.symbol),
    );
    return (instruments.data ?? []).map((i) => ({ ...i, isFavourite: starred.has(i.symbol) }));
  }, [instruments.data, favourites.data, tradingMode]);

  const favouriteOptions = useMemo(() => options.filter((o) => o.isFavourite), [options]);

  return {
    options,
    favourites: favouriteOptions,
    tradingMode,
    isLoading: instruments.isLoading,
    isError: instruments.isError,
  };
}
