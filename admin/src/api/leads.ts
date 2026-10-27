import type { LeadKind } from '@bom/shared';
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

// Quiz and wholesale hand-offs (docs/API.md §6, Leads).

export function useLeads(kind: 'all' | LeadKind) {
  return useInfiniteQuery({
    queryKey: keys.leads(kind),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/admin/leads', {
          params: {
            query: {
              limit: 50,
              ...(kind !== 'all' ? { kind } : {}),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** Owner only: removes a test or spam hand-off. */
export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/leads/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.leads() }),
  });
}
