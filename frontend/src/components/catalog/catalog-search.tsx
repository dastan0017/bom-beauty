import { copy } from '@/content/copy';
import type { CatalogFilters } from '@/lib/catalog-href';
import { SearchBox } from '../search-box';

/** Catalog search (owner request 2026-10-26): `?q=` beside the problem, type and brand filters, which it keeps. */
export function CatalogSearch({
  query,
  filters,
  className,
}: {
  query: string;
  filters: Omit<CatalogFilters, 'q'>;
  className?: string;
}) {
  return (
    <SearchBox
      path="/catalog"
      query={query}
      // The order of catalogHref, so both build the same address.
      params={{ problem: filters.problem, category: filters.category, brand: filters.brand }}
      label={copy.catalog.searchLabel}
      placeholder={copy.catalog.searchPlaceholder}
      clearLabel={copy.catalog.clearSearch}
      {...(className ? { className } : {})}
    />
  );
}
