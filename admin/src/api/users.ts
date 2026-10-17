import type { AdminUser, CreateUser, UserRole } from '@bom/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => unwrap(api.GET('/v1/admin/users')) });
}

export function useUserActions() {
  const queryClient = useQueryClient();
  const setUsers = (users: AdminUser[]) => queryClient.setQueryData(keys.users, users);
  return {
    create: useMutation({
      mutationFn: (body: CreateUser) => unwrap(api.POST('/v1/admin/users', { body })),
      onSuccess: setUsers,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        change,
      }: {
        id: string;
        change: { name?: string; role?: UserRole; isActive?: boolean };
      }) => unwrap(api.PUT('/v1/admin/users/{id}', { params: { path: { id } }, body: change })),
      onSuccess: setUsers,
    }),
    password: useMutation({
      mutationFn: ({ id, password }: { id: string; password: string }) =>
        unwrap(api.POST('/v1/admin/users/{id}/password', { params: { path: { id } }, body: { password } })),
    }),
    revokeOthers: useMutation({ mutationFn: () => unwrap(api.POST('/v1/admin/sessions/revoke-all')) }),
  };
}

export function useAudit(entity: string) {
  return useInfiniteQuery({
    queryKey: keys.audit(entity),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/admin/audit', {
          params: {
            query: { limit: 50, ...(entity ? { entity } : {}), ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}
