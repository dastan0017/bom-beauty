import type {
  OrderDetail,
  OrderList,
  OrderPaymentStatus,
  OrderRow,
  OrderStatus,
  UpdateOrder,
} from '@bom/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

export interface OrderFilters {
  status?: OrderStatus;
  q?: string;
}

const orderKeys = keys.orders;

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
    // Lists and the drawer show the new status (or payment status) at once; on failure they come back (rollback).
    onMutate: async ({ id, change }) => {
      if (!change.status && !change.paymentStatus) return { previous: [], detail: undefined };
      await queryClient.cancelQueries({ queryKey: orderKeys.lists });
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(id) });
      const previous = queryClient.getQueriesData<InfiniteData<OrderList>>({ queryKey: orderKeys.lists });
      const detail = queryClient.getQueryData<OrderDetail>(orderKeys.detail(id));
      setRow(queryClient, id, {
        ...(change.status ? { status: change.status } : {}),
        ...(change.paymentStatus ? { paymentStatus: change.paymentStatus } : {}),
      });
      if (detail) {
        queryClient.setQueryData<OrderDetail>(orderKeys.detail(id), {
          ...detail,
          ...(change.status ? { status: change.status } : {}),
          ...(change.paymentStatus ? { payment: { ...detail.payment, status: change.paymentStatus } } : {}),
        });
      }
      return { previous, detail };
    },
    onError: (_error, { id }, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
      if (context?.detail) queryClient.setQueryData(orderKeys.detail(id), context.detail);
    },
    onSuccess: (order: OrderDetail) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      setRow(queryClient, order.id, { status: order.status, paymentStatus: order.payment.status });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.counters });
      void queryClient.invalidateQueries({ queryKey: keys.dashboard() });
      void queryClient.invalidateQueries({ queryKey: keys.customers() });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/orders/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: keys.dashboard() });
      void queryClient.invalidateQueries({ queryKey: keys.customers() });
    },
  });
}

function setRow(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: { status?: OrderStatus; paymentStatus?: OrderPaymentStatus },
): void {
  queryClient.setQueriesData<InfiniteData<OrderList>>({ queryKey: orderKeys.lists }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((row): OrderRow => (row.id === id ? { ...row, ...patch } : row)),
          })),
        }
      : data,
  );
}
