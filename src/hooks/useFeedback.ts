import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedbackDraft, FeedbackPatch } from '@/types';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';

/** The signed-in user's own submissions, with their triage status. */
export function useMyFeedback() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['feedback', 'mine', user?.id],
    queryFn: () => api.feedback.listMine(user!.id),
    enabled: Boolean(user),
  });
}

export function useSubmitFeedback() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: FeedbackDraft) => api.feedback.submit(user!.id, draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feedback', 'mine', user?.id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

export function useAdminFeedback() {
  return useQuery({ queryKey: ['admin', 'feedback'], queryFn: () => api.admin.feedback() });
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FeedbackPatch }) =>
      api.admin.updateFeedback(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feedback'] }),
  });
}
