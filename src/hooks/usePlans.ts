import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Plan } from '@/types';
import { api } from '@/services';

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: () => api.plans.list() });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Plan, 'id' | 'code'>> }) =>
      api.plans.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}
