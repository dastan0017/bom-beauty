'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { CloseIcon, SearchIcon } from './icons';

const TYPING_PAUSE_MS = 300;

/** `path?…params&q=…` with empty values left out, in the order given. */
export function searchHref(path: string, params: Record<string, string | undefined>, query: string): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const q = query.trim();
  if (q) search.set('q', q);
  const text = search.toString();
  return (text ? `${path}?${text}` : path) as Route;
}

/**
 * Search field of the catalog and the programs list (owner requests 2026-10-26 and 2026-11-14; the design has none). A
 * GET form, so it works without JavaScript; with it, the results follow the typing after a short pause. The page's
 * other parameters stay as they are.
 */
export function SearchBox({
  path,
  query,
  params = {},
  label,
  placeholder,
  clearLabel,
  className,
}: {
  path: string;
  query: string;
  /** The page's other parameters, kept by the search and its clear button. */
  params?: Record<string, string | undefined>;
  label: string;
  placeholder: string;
  clearLabel: string;
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
    router.replace(searchHref(path, params, value), { scroll: false });
  };

  return (
    <form
      role="search"
      action={path}
      method="get"
      className={cn('min-w-0', className)}
      onSubmit={(event) => {
        event.preventDefault();
        search(input.current?.value ?? '');
        input.current?.blur();
      }}
    >
      {Object.entries(params).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
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
          aria-label={label}
          placeholder={placeholder}
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
            href={searchHref(path, params, '')}
            replace
            scroll={false}
            aria-label={clearLabel}
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
