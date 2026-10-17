import type { DashboardPeriod, LeadKind, OrderStatus } from '@bom/shared';

/** Every TanStack Query key of the admin comes from here (CLAUDE.md, admin rules). */
export const keys = {
  me: ['me'] as const,
  orders: {
    all: ['orders'] as const,
    counters: ['orders', 'counters'] as const,
    lists: ['orders', 'list'] as const,
    list: (filters: { status?: OrderStatus; q?: string }) => ['orders', 'list', filters] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  dashboard: (period?: DashboardPeriod) =>
    period ? (['dashboard', period] as const) : (['dashboard'] as const),
  leads: (kind?: LeadKind | 'all') => (kind ? (['leads', kind] as const) : (['leads'] as const)),
  customers: (q?: string) => (q === undefined ? (['customers'] as const) : (['customers', q] as const)),
  categories: ['categories'] as const,
  brands: (q: string) => ['brands', q] as const,
  products: {
    all: ['products'] as const,
    list: (filters: { category?: string; q?: string }) => ['products', 'list', filters] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  programs: {
    all: ['programs'] as const,
    list: ['programs', 'list'] as const,
    detail: (id: string) => ['programs', 'detail', id] as const,
  },
  reviews: ['reviews'] as const,
  media: (id: string) => ['media', id] as const,
  video: (id: string) => ['video', id] as const,
  content: (key: string) => ['content', key] as const,
  settings: ['settings'] as const,
  users: ['users'] as const,
  audit: (entity: string) => ['audit', entity] as const,
};
