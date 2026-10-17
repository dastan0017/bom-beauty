import type { OrderDetail, OrderList, OrderStatus, UpdateOrder } from '@bom/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface OrderFilters {
  status?: OrderStatus;
  q?: string;
}

export const orderKeys = {
  all: ['orders'] as const,
  counters: ['orders', 'counters'] as const,
  list: (filters: OrderFilters) => ['orders', 'list', filters] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

/** Tab counts and the nav badge; polled every 15 s and on window focus (docs/TASKS.md M3). */
export function useOrderCounters() {
  return useQuery({
    queryKey: orderKeys.counters,
    queryFn: () => unwrap(api.GET('/v1/admin/orders/counters')),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useOrders(filters: OrderFilters) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/admin/orders', {
          params: {
            query: {
              limit: 50,
              ...(filters.status ? { status: filters.status } : {}),
              ...(filters.q ? { q: filters.q } : {}),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/v1/admin/orders/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: UpdateOrder }) =>
      unwrap(api.PATCH('/v1/admin/orders/{id}', { params: { path: { id } }, body: change })),
    // Lists show the new status at once; the server answer replaces it.
    onMutate: ({ id, change }) => {
      if (change.status) setRowStatus(queryClient, id, change.status);
    },
    onSuccess: (order: OrderDetail) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      setRowStatus(queryClient, order.id, order.status);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.counters });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/orders/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

function setRowStatus(queryClient: ReturnType<typeof useQueryClient>, id: string, status: OrderStatus): void {
  queryClient.setQueriesData<InfiniteData<OrderList>>({ queryKey: ['orders', 'list'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((row) => (row.id === id ? { ...row, status } : row)),
          })),
        }
      : data,
  );
}
