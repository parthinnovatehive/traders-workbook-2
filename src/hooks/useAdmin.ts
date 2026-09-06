import { useQuery } from '@tanstack/react-query';
import { api } from '@/services';

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.admin.users() });
}

export function useAdminSubscriptions() {
  return useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: () => api.admin.subscriptions() });
}
