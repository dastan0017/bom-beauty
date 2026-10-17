import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

export type ContentKey = 'home' | 'wholesale' | 'delivery' | 'privacy' | 'offer';

export function useContent(key: ContentKey) {
  return useQuery({
    queryKey: keys.content(key),
    queryFn: () => unwrap(api.GET('/v1/admin/content/{key}', { params: { path: { key } } })),
  });
}

export function useSaveContent(key: ContentKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      unwrap(api.PUT('/v1/admin/content/{key}', { params: { path: { key } }, body: { data } })),
    onSuccess: (content) => queryClient.setQueryData(keys.content(key), content),
  });
}
