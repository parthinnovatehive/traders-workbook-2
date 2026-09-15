import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RiskSettingPatch, TradingMode } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

/**
 * The risk rules for one book — defaults to the mode currently selected in the
 * UI. Rules are per mode because `dailyLossLimit` is an absolute amount in that
 * book's currency: ₹10,000 and $10,000 are different rules, not one number
 * rendered two ways.
 */
export function useRiskSetting(mode?: TradingMode) {
  const user = useAuthStore((s) => s.user);
  const activeMode = useUiStore((s) => s.tradingMode);
  const tradingMode = mode ?? activeMode;

  return useQuery({
    queryKey: ['risk', user?.id, tradingMode],
    queryFn: () => api.risk.get(user!.id, tradingMode),
    enabled: Boolean(user),
  });
}

export function useUpdateRiskSetting(mode?: TradingMode) {
  const user = useAuthStore((s) => s.user);
  const activeMode = useUiStore((s) => s.tradingMode);
  const tradingMode = mode ?? activeMode;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (patch: RiskSettingPatch) => api.risk.update(user!.id, tradingMode, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', user?.id, tradingMode] }),
  });
}
