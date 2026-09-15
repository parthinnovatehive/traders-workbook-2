import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SiteContentPatch } from '@/types';
import { api } from '@/services';
import { DEFAULT_CONTENT } from '@/config/content';

/**
 * Editable marketing copy, FAQ and announcement banner.
 *
 * Cached hard and seeded with the bundled defaults, so the marketing site
 * renders its real copy on first paint instead of flashing empty headings while
 * the row loads — and still renders if the request fails outright.
 */
export function useSiteContent() {
  return useQuery({
    queryKey: ['site-content'],
    queryFn: () => api.content.get(),
    staleTime: 5 * 60_000,
    placeholderData: DEFAULT_CONTENT,
  });
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SiteContentPatch) => api.admin.updateContent(patch),
    onSuccess: (content) => {
      qc.setQueryData(['site-content'], content);
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
