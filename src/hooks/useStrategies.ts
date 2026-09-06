import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';

export function useStrategies() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['strategies', user?.id],
    queryFn: () => api.strategies.list(user!.id),
    enabled: Boolean(user),
  });
}

export function useCreateStrategy() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api.strategies.create(user!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies', user?.id] }),
  });
}

export function useDeleteStrategy() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.strategies.remove(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies', user?.id] }),
  });
}
