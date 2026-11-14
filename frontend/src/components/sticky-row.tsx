'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { container } from './ui';

/** Pages whose sticky row sits under the header; the header pills go below it there. */
export const STICKY_ROW_PATHS = ['/catalog', '/programs'];

/**
 * The sticky row under the site header with the page's search (the catalog since 2026-10-27, the programs list since
 * 2026-11-14); a soft shadow once it is stuck.
 */
export function StickyRow({ children, id }: { children: ReactNode; id?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const update = () => {
      const top = parseFloat(getComputedStyle(element).top) || 0;
      setStuck(window.scrollY > 0 && element.getBoundingClientRect().top <= top + 0.5);
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div
      ref={bar}
      id={id}
      className={cn(
        'sticky top-[var(--header-h)] z-20 mt-3 bg-bg transition-shadow duration-200',
        stuck && 'shadow-[0_12px_20px_-16px_rgba(14,14,44,.35)]',
      )}
    >
      <div className={cn(container, 'flex h-[var(--catalog-bar-h)] items-center gap-2 px-4')}>{children}</div>
    </div>
  );
}

/**
 * After a new search, brings the start of the results back under the sticky row when the page was scrolled past it
 * (a shorter list would otherwise leave the first results above the screen). The first render never scrolls.
 */
export function KeepResultsInView({
  query,
  rowId,
  resultsId,
}: {
  query: string;
  rowId: string;
  resultsId: string;
}) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const row = document.getElementById(rowId);
    const results = document.getElementById(resultsId);
    if (!row || !results) return;
    const gap = results.getBoundingClientRect().top - row.getBoundingClientRect().bottom;
    if (gap < 0) window.scrollBy({ top: gap - 8 });
  }, [query, rowId, resultsId]);
  return null;
}
