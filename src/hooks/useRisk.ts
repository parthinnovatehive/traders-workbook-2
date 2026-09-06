import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RiskSetting } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';

export function useRiskSetting() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['risk', user?.id],
    queryFn: () => api.risk.get(user!.id),
    enabled: Boolean(user),
  });
}

export function useUpdateRiskSetting() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<RiskSetting, 'id' | 'userId'>>) =>
      api.risk.update(user!.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', user?.id] }),
  });
}
