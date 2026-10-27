'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { copy } from '@/content/copy';
import { catalogHref, type CatalogFilters } from '@/lib/catalog-href';
import { cn } from '@/lib/cn';
import { CloseIcon, SearchIcon } from '../icons';

const TYPING_PAUSE_MS = 300;

/**
 * Catalog search (owner request 2026-10-26; the design has none). A GET form, so it works without JavaScript; with it,
 * the results follow the typing after a short pause. The other filters stay as they are.
 */
export function CatalogSearch({
  query,
  filters,
  className,
}: {
  query: string;
  filters: Omit<CatalogFilters, 'q'>;
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Back, forward and the reset links change the query from outside; while the visitor types, their text stays.
  useEffect(() => {
    const element = input.current;
    if (element && document.activeElement !== element) element.value = query;
  }, [query]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const search = (value: string) => {
    window.clearTimeout(timer.current);
    router.replace(catalogHref({ ...filters, q: value }), { scroll: false });
  };

  return (
    <form
      role="search"
      action="/catalog"
      method="get"
      className={cn('min-w-0', className)}
      onSubmit={(event) => {
        event.preventDefault();
        search(input.current?.value ?? '');
        input.current?.blur();
      }}
    >
      {filters.problem && <input type="hidden" name="problem" value={filters.problem} />}
      {filters.category && <input type="hidden" name="category" value={filters.category} />}
      {filters.brand && <input type="hidden" name="brand" value={filters.brand} />}
      <div className="relative">
        <SearchIcon
          size={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
        />
        <input
          ref={input}
          name="q"
          type="search"
          defaultValue={query}
          aria-label={copy.catalog.searchLabel}
          placeholder={copy.catalog.searchPlaceholder}
          enterKeyHint="search"
          autoComplete="off"
          maxLength={100}
          onChange={(event) => {
            const value = event.target.value;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => search(value), TYPING_PAUSE_MS);
          }}
          className={cn(
            'h-11 w-full rounded-xl border border-line bg-surface pl-10 text-base text-ink outline-none placeholder:text-muted',
            query ? 'pr-11' : 'pr-3',
            'focus:border-accent focus:shadow-[0_0_0_4px_var(--halo)] [&::-webkit-search-cancel-button]:appearance-none',
          )}
        />
        {query && (
          <Link
            href={catalogHref(filters)}
            replace
            scroll={false}
            aria-label={copy.catalog.clearSearch}
            onClick={() => {
              window.clearTimeout(timer.current);
              if (input.current) input.current.value = '';
            }}
            className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-xl text-muted hover:text-ink"
          >
            <CloseIcon size={18} />
          </Link>
        )}
      </div>
    </form>
  );
}
