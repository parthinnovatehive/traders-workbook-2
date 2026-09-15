import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InstrumentPatch } from '@/services';
import { api } from '@/services';

export function useAdminOverview() {
  return useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.admin.overview() });
}

export function useAdminSignups(days = 30) {
  return useQuery({
    queryKey: ['admin', 'signups', days],
    queryFn: () => api.admin.signupSeries(days),
  });
}

/** The user directory: profile, plan and trade COUNT — never trade detail. */
export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.admin.userRows() });
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: ['admin', 'subscriptions'],
    queryFn: () => api.admin.subscriptions(),
  });
}

export function useAdminAuditLog(limit = 200) {
  return useQuery({
    queryKey: ['admin', 'audit', limit],
    queryFn: () => api.admin.auditLog(limit),
  });
}

/** Invalidates everything an admin mutation could have changed. */
function useAdminMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useSetUserRole() {
  return useAdminMutation(({ userId, role }: { userId: string; role: 'user' | 'admin' }) =>
    api.admin.setUserRole(userId, role),
  );
}

export function useSetUserSuspended() {
  return useAdminMutation(
    ({ userId, suspended, reason }: { userId: string; suspended: boolean; reason?: string }) =>
      api.admin.setUserSuspended(userId, suspended, reason),
  );
}

export function useSetSubscription() {
  return useAdminMutation(
    ({
      userId,
      planId,
      status,
      months,
    }: {
      userId: string;
      planId: string;
      status?: string;
      months?: number;
    }) => api.admin.setSubscription(userId, planId, status, months),
  );
}

export function useUpdateInstrument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: InstrumentPatch }) =>
      api.admin.updateInstrument(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      // The picker caches instruments hard; a lot-size correction must reach it.
      void qc.invalidateQueries({ queryKey: ['instruments'] });
    },
  });
}
