'use client';

import type { Route } from 'next';
import Link from 'next/link';
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { CloseIcon, FiltersIcon } from '../icons';
import { SheetHandle } from '../overlays/sheet';
import { useModal, usePresence } from '../overlays/use-dialog';
import { container } from '../ui';

// Compact catalog filters (2026-10-27): the design's three chip rows took most of a phone screen, so the catalog has
// one sticky row with the search and a «Фильтры» button, and the chip groups live in a bottom sheet. Without
// JavaScript the button is an anchor and the sheet opens through :target; every choice inside it is a plain link.

const SHEET_ID = 'catalog-filters';
const BAR_ID = 'catalog-bar';
export const RESULTS_ID = 'catalog-results';

const FiltersContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function useFilters() {
  const context = use(FiltersContext);
  if (!context) throw new Error('Catalog filters outside CatalogFiltersProvider');
  return context;
}

const subscribeNothing = () => () => undefined;
/** False on the server and during hydration, true afterwards. */
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

export function CatalogFiltersProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <FiltersContext value={{ open, setOpen }}>{children}</FiltersContext>;
}

/** The sticky row under the site header; a soft shadow once it is stuck. */
export function CatalogBar({ children }: { children: ReactNode }) {
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
      id={BAR_ID}
      className={cn(
        'sticky top-[var(--header-h)] z-20 mt-3 bg-bg transition-shadow duration-200',
        stuck && 'shadow-[0_12px_20px_-16px_rgba(14,14,44,.35)]',
      )}
    >
      <div className={cn(container, 'flex h-[var(--catalog-bar-h)] items-center gap-2 px-4')}>{children}</div>
    </div>
  );
}

export function FiltersButton({ count }: { count: number }) {
  const { setOpen } = useFilters();
  return (
    <a
      href={`#${SHEET_ID}`}
      role="button"
      aria-haspopup="dialog"
      onClick={(event) => {
        event.preventDefault();
        setOpen(true);
      }}
      className={cn(
        'flex h-11 flex-none items-center gap-2 rounded-xl border px-3.5 text-[15px] font-semibold',
        count ? 'border-chip bg-chip text-white' : 'border-line bg-surface text-ink hover:border-line-hover',
      )}
    >
      <FiltersIcon size={18} />
      <span>{copy.catalog.filters}</span>
      {count > 0 && (
        <>
          <span
            aria-hidden="true"
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-ink"
          >
            {count}
          </span>
          <span className="sr-only">{copy.catalog.filtersChosen(count)}</span>
        </>
      )}
    </a>
  );
}

/**
 * The filter groups in a bottom sheet (a centred dialog from 640 px, like the site's other sheets). Choices apply at
 * once, so the count on «Показать» follows them; the sheet stays open until the visitor closes it.
 */
export function FiltersSheet({
  resultsHref,
  resultsLabel,
  resetHref,
  children,
}: {
  resultsHref: Route;
  resultsLabel: string;
  resetHref: Route | null;
  children: ReactNode;
}) {
  const { open, setOpen } = useFilters();
  const hydrated = useHydrated();
  const { mounted, visible } = usePresence(open);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useModal(panel, open, close);

  // Opened through the anchor before the page hydrated: carry on as a script-driven sheet.
  useEffect(() => {
    if (window.location.hash !== `#${SHEET_ID}`) return;
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    setOpen(true);
  }, [setOpen]);

  const closeBy = (event: MouseEvent) => {
    event.preventDefault();
    close();
  };
  const showResults = (event: MouseEvent) => {
    closeBy(event);
    // Once the page is scrolled past the start of the list, bring the first results under the bar.
    requestAnimationFrame(() => {
      const results = document.getElementById(RESULTS_ID);
      const bar = document.getElementById(BAR_ID);
      if (!results || !bar) return;
      const gap = results.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
      if (gap < 0) window.scrollBy({ top: gap - 8 });
    });
  };

  return (
    <div
      id={SHEET_ID}
      className={cn(
        'fixed inset-0 z-40 sm:items-center sm:justify-center sm:p-6',
        hydrated ? (mounted ? 'flex' : 'hidden') : 'hidden target:flex',
        hydrated && !open && 'pointer-events-none',
      )}
    >
      <a
        href={resultsHref}
        aria-hidden="true"
        tabIndex={-1}
        onClick={closeBy}
        className={cn(
          'absolute inset-0 bg-[rgba(14,14,44,.5)] transition-opacity duration-300',
          hydrated && !visible ? 'opacity-0' : 'opacity-100',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={copy.catalog.filters}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white text-ink shadow-[0_-24px_60px_rgba(14,14,44,.2)] outline-none',
          'transition-transform duration-[360ms] ease-[cubic-bezier(.2,.8,.2,1)]',
          'sm:relative sm:inset-auto sm:w-full sm:max-w-[480px] sm:rounded-3xl',
          hydrated && !visible && 'translate-y-full sm:translate-y-[calc(100%+3rem)]',
        )}
      >
        <div className="flex flex-col px-5 pt-2.5">
          <SheetHandle />
          <div className="mt-3 flex items-center justify-between gap-3">
            <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{copy.catalog.filters}</h2>
            <Link
              href={resultsHref}
              scroll={false}
              aria-label={copy.common.close}
              onClick={closeBy}
              className="flex size-11 flex-none items-center justify-center rounded-full bg-surface-2 text-ink"
            >
              <CloseIcon size={18} />
            </Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        <div className="flex gap-2.5 border-t border-line-2 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {resetHref && (
            <Link
              href={resetHref}
              scroll={false}
              className="flex h-[52px] flex-none items-center rounded-button border border-line px-4 text-[15px] font-semibold text-ink"
            >
              {copy.catalog.reset}
            </Link>
          )}
          <Link
            href={resultsHref}
            scroll={false}
            onClick={showResults}
            className="flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-button bg-accent px-4 text-center text-base font-semibold text-white hover:brightness-[.94] active:brightness-[.88]"
          >
            {resultsLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
