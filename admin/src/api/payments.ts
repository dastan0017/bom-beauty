import { useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

// «Настройки → Оплата» (owner): Finik's connection and the 1 сом check (docs/finik/SPEC.md §7.2).

export function useFinikStatus() {
  return useQuery({
    queryKey: keys.payments.finik,
    queryFn: () => unwrap(api.GET('/v1/admin/payments/finik')),
  });
}

export function useStartFinikCheck() {
  return useMutation({ mutationFn: () => unwrap(api.POST('/v1/admin/payments/finik/check')) });
}

/** The check payment, polled every 3 s while it waits to be paid. */
export function usePaymentCheck(id: string | null) {
  return useQuery({
    queryKey: keys.payments.check(id ?? ''),
    queryFn: () => unwrap(api.GET('/v1/admin/payments/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3_000 : false),
  });
}
