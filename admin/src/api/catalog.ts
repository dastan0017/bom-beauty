import type { AdminProductRow, AdminProgramRow, AdminReview, ProductInput, ProgramInput } from '@bom/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

// Categories, brands, products, programs and reviews (docs/API.md §6, Catalog).

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => unwrap(api.GET('/v1/admin/categories')) });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.POST('/v1/admin/categories', { body: { name } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/categories/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.categories }),
  });
}

/** After a rename, merge or delete of a category or brand: every list that shows them. */
function invalidateTaxonomy(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: keys.categories });
  void queryClient.invalidateQueries({ queryKey: keys.brandsAll });
  void queryClient.invalidateQueries({ queryKey: keys.products.all });
}

export function useRenameCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(api.PUT('/v1/admin/categories/{id}', { params: { path: { id } }, body: { name } })),
    onSuccess: () => invalidateTaxonomy(queryClient),
  });
}

export function useMergeCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, intoId }: { id: string; intoId: string }) =>
      unwrap(api.POST('/v1/admin/categories/{id}/merge', { params: { path: { id } }, body: { intoId } })),
    onSuccess: () => invalidateTaxonomy(queryClient),
  });
}

export function useRenameBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(api.PUT('/v1/admin/brands/{id}', { params: { path: { id } }, body: { name } })),
    onSuccess: () => invalidateTaxonomy(queryClient),
  });
}

export function useMergeBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, intoId }: { id: string; intoId: string }) =>
      unwrap(api.POST('/v1/admin/brands/{id}/merge', { params: { path: { id } }, body: { intoId } })),
    onSuccess: () => invalidateTaxonomy(queryClient),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/brands/{id}', { params: { path: { id } } })),
    onSuccess: () => invalidateTaxonomy(queryClient),
  });
}

export function useBrands(q: string) {
  return useQuery({
    queryKey: keys.brands(q),
    queryFn: () => unwrap(api.GET('/v1/admin/brands', { params: { query: q ? { q } : {} } })),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useProducts(filters: { category?: string; q?: string }) {
  return useQuery({
    queryKey: keys.products.list(filters),
    queryFn: () => unwrap(api.GET('/v1/admin/products', { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: keys.products.detail(id ?? 'new'),
    queryFn: () => unwrap(api.GET('/v1/admin/products/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
  });
}

export function useSaveProduct(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) =>
      id
        ? unwrap(api.PUT('/v1/admin/products/{id}', { params: { path: { id } }, body }))
        : unwrap(api.POST('/v1/admin/products', { body })),
    onSuccess: (product) => {
      queryClient.setQueryData(keys.products.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: keys.products.all });
      void queryClient.invalidateQueries({ queryKey: keys.categories });
      void queryClient.invalidateQueries({ queryKey: keys.programs.all });
      // A save may create a brand or change its «О бренде».
      void queryClient.invalidateQueries({ queryKey: keys.brandsAll });
    },
  });
}

/** Stock switch in the table: optimistic, rolled back on failure. */
export function usePatchProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: { inStock?: boolean; published?: boolean } }) =>
      unwrap(api.PATCH('/v1/admin/products/{id}', { params: { path: { id } }, body: change })),
    onMutate: async ({ id, change }) => {
      await queryClient.cancelQueries({ queryKey: keys.products.all });
      const previous = queryClient.getQueriesData<AdminProductRow[]>({ queryKey: ['products', 'list'] });
      queryClient.setQueriesData<AdminProductRow[]>({ queryKey: ['products', 'list'] }, (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, ...change } : row)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.products.all }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/products/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.products.all });
      void queryClient.invalidateQueries({ queryKey: keys.categories });
      // The product also leaves its programs and the wholesale page's featured list.
      void queryClient.invalidateQueries({ queryKey: keys.programs.all });
      void queryClient.invalidateQueries({ queryKey: keys.content('wholesale') });
    },
  });
}

export function usePrograms() {
  return useQuery({ queryKey: keys.programs.list, queryFn: () => unwrap(api.GET('/v1/admin/programs')) });
}

export function useProgram(id: string | null) {
  return useQuery({
    queryKey: keys.programs.detail(id ?? 'new'),
    queryFn: () => unwrap(api.GET('/v1/admin/programs/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
  });
}

export function useSaveProgram(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProgramInput) =>
      id
        ? unwrap(api.PUT('/v1/admin/programs/{id}', { params: { path: { id } }, body }))
        : unwrap(api.POST('/v1/admin/programs', { body })),
    onSuccess: (program) => {
      queryClient.setQueryData(keys.programs.detail(program.id), program);
      void queryClient.invalidateQueries({ queryKey: keys.programs.list });
      void queryClient.invalidateQueries({ queryKey: keys.products.all });
    },
  });
}

/** "На сайте" switch in the list: optimistic, rolled back on failure. */
export function usePatchProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: { published?: boolean; inStock?: boolean } }) =>
      unwrap(api.PATCH('/v1/admin/programs/{id}', { params: { path: { id } }, body: change })),
    onMutate: async ({ id, change }) => {
      await queryClient.cancelQueries({ queryKey: keys.programs.list });
      const previous = queryClient.getQueryData<AdminProgramRow[]>(keys.programs.list);
      queryClient.setQueryData<AdminProgramRow[]>(keys.programs.list, (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, ...change } : row)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.programs.list, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.programs.all }),
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/programs/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.programs.all }),
  });
}

export function useReviews() {
  return useQuery({ queryKey: keys.reviews, queryFn: () => unwrap(api.GET('/v1/admin/reviews')) });
}

export function useReviewActions() {
  const queryClient = useQueryClient();
  const settle = { onSuccess: (rows: AdminReview[]) => queryClient.setQueryData(keys.reviews, rows) };
  return {
    create: useMutation({
      mutationFn: (mediaIds: string[]) => unwrap(api.POST('/v1/admin/reviews', { body: { mediaIds } })),
      ...settle,
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => unwrap(api.PUT('/v1/admin/reviews/order', { body: { ids } })),
      ...settle,
    }),
    toggle: useMutation({
      mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
        unwrap(api.PATCH('/v1/admin/reviews/{id}', { params: { path: { id } }, body: { isHidden } })),
      ...settle,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api.DELETE('/v1/admin/reviews/{id}', { params: { path: { id } } })),
      ...settle,
    }),
  };
}
