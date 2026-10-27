import type { Route } from 'next';

export interface CatalogFilters {
  problem?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  q?: string | undefined;
}

/** Catalog URL for a set of filters; chips are links and search is a GET form, so all of it works without JS. */
export function catalogHref(filters: CatalogFilters): Route {
  const params = new URLSearchParams();
  if (filters.problem) params.set('problem', filters.problem);
  if (filters.category) params.set('category', filters.category);
  if (filters.brand) params.set('brand', filters.brand);
  const q = filters.q?.trim();
  if (q) params.set('q', q);
  const query = params.toString();
  return (query ? `/catalog?${query}` : '/catalog') as Route;
}
