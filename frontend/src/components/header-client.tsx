'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type AnchorHTMLAttributes } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { track } from '@/lib/submission';
import { itemsWord } from '@bom/shared/web';
import { useCart } from './cart/cart';
import { currencySymbol, useCurrency } from './currency';
import { BagIcon, ChevronDownIcon, CloseIcon, SparkleIcon } from './icons';
import { useOverlays } from './overlays/site-overlays';

const TABS = [
  { key: 'catalog', href: '/catalog' },
  { key: 'programs', href: '/programs' },
  { key: 'wholesale', href: '/wholesale' },
] as const;

export function HeaderTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={copy.common.sections}
      className="mx-4 mb-2.5 flex gap-0.5 rounded-tabs bg-tabs-track p-0.5 lg:order-2 lg:mx-0 lg:mb-0 lg:w-[420px]"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'tap flex h-10 flex-1 items-center justify-center rounded-tab text-[15px] font-semibold',
              active
                ? 'bg-white text-tabs-active-ink shadow-[0_1px_3px_rgba(20,20,43,.12)]'
                : 'text-tabs-ink hover:bg-tabs-hover',
            )}
          >
            {copy.header.tabs[tab.key]}
          </Link>
        );
      })}
    </nav>
  );
}

export function CurrencyPicker() {
  const { code, options, setCode } = useCurrency();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !root.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          // Narrow phones: tighter padding and gap so the logo, currency and WhatsApp fit on one row (README §8).
          'flex h-11 items-center gap-1 rounded-[14px] pr-1.5 pl-0.5 whitespace-nowrap text-ink transition-colors',
          open ? 'bg-white/55' : 'bg-transparent',
        )}
      >
        <span className="sr-only">{copy.header.currency}: </span>
        <span className="flex h-8 items-center gap-[5px] rounded-full border-[1.5px] border-accent px-3 text-[15px] leading-none font-semibold">
          <span>{currencySymbol(code)}</span>
          <span>{code}</span>
        </span>
        <ChevronDownIcon size={14} className={cn('flex-none transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={copy.header.currency}
          className="absolute top-[calc(100%+4px)] right-0 z-40 flex flex-col rounded-2xl border border-line bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(19,35,63,.3)]"
        >
          {options.map((option) => (
            <li key={option.code} role="option" aria-selected={option.code === code}>
              <button
                type="button"
                onClick={() => {
                  setCode(option.code);
                  setOpen(false);
                }}
                className={cn(
                  'flex h-11 w-full items-center gap-1.5 rounded-[10px] pr-[18px] pl-3.5 text-[17px] whitespace-nowrap text-ink hover:bg-surface-2',
                  option.code === code && 'font-semibold',
                )}
              >
                <span>{currencySymbol(option.code)}</span>
                <span>{option.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Floating pills just under the header, top right (design: hdrCart, qPill): the home cart pill and
 * «К результатам теста». The stack lets taps through except on the pills themselves.
 */
export function HeaderPills() {
  return (
    <div className="pointer-events-none absolute top-[calc(100%+10px)] right-3 flex flex-col items-end gap-2 lg:right-6">
      <CartPill />
      <QuizPill />
    </div>
  );
}

/** Cart count and total on the home page while the cart has products; there is no cart icon in the header. */
function CartPill() {
  const pathname = usePathname();
  const { count, totalKgs } = useCart();
  const { openCart, busy } = useOverlays();
  const { format } = useCurrency();
  if (pathname !== '/' || count === 0 || busy) return null;
  return (
    <button
      type="button"
      onClick={openCart}
      className="pointer-events-auto flex h-12 items-center gap-3 rounded-button bg-accent pr-4 pl-3.5 text-left text-white shadow-[0_14px_26px_-12px_var(--acsh)] active:scale-[.97]"
    >
      <span className="relative flex flex-none">
        <BagIcon size={19} strokeWidth={1.9} />
        <span
          aria-hidden
          className="absolute -top-1.5 -right-[7px] flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-accent-ink"
        >
          {count}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-xs leading-[1.2] whitespace-nowrap">
          {copy.cart.summary(`${count} ${itemsWord(count)}`)}
        </span>{' '}
        <span className="text-[15px] leading-[1.2] font-semibold whitespace-nowrap">{format(totalKgs)}</span>
      </span>
    </button>
  );
}

/** "К результатам теста" pill under the header once the quiz has results (design: qPill). */
function QuizPill() {
  const { quizDone, quizPillHidden, hideQuizPill, returnToQuiz, busy } = useOverlays();
  if (!quizDone || quizPillHidden || busy) return null;
  return (
    <div className="pointer-events-auto flex h-12 items-center gap-1.5 rounded-full bg-ink py-0 pr-1.5 pl-3 text-[13px] leading-[1.2] font-semibold text-white shadow-[0_12px_26px_-12px_rgba(14,14,44,.5)]">
      <button type="button" onClick={returnToQuiz} className="flex items-center gap-1.5">
        <SparkleIcon size={14} className="flex-none" />
        <span className="flex flex-col items-center text-center whitespace-nowrap">
          <span>{copy.quiz.pill[0]}</span> <span>{copy.quiz.pill[1]}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={hideQuizPill}
        aria-label={copy.quiz.hidePill}
        className="flex size-8 flex-none items-center justify-center rounded-full bg-white/15"
      >
        <CloseIcon size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** External link (WhatsApp, Instagram) that reports a click to analytics. */
export function TrackedLink({
  event,
  place,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; event: string; place: string }) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      {...props}
      onClick={(clickEvent) => {
        track(event, { place });
        props.onClick?.(clickEvent);
      }}
    />
  );
}
