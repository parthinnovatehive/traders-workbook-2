import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradingMode } from '@/types';
import type { DatePreset, DateRange } from '@/utils/date';

export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  tradingMode: TradingMode;
  datePreset: DatePreset;
  customRange: DateRange;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setTradingMode: (mode: TradingMode) => void;
  setDatePreset: (preset: DatePreset) => void;
  setCustomRange: (range: DateRange) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarOpen: false,
      tradingMode: 'forex',
      datePreset: 'all',
      customRange: { start: null, end: null },
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setTradingMode: (tradingMode) => set({ tradingMode }),
      setDatePreset: (datePreset) => set({ datePreset }),
      setCustomRange: (customRange) => set({ customRange, datePreset: 'custom' }),
    }),
    {
      name: 'twb.ui',
      partialize: (s) => ({
        theme: s.theme,
        tradingMode: s.tradingMode,
        datePreset: s.datePreset,
        customRange: s.customRange,
      }),
    },
  ),
);
