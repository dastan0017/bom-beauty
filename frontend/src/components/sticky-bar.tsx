'use client';

import { itemsWord } from '@bom/shared/web';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { useCart } from './cart/cart';
import { useCurrency } from './currency';
import { ArrowRightIcon, BagIcon, SparkleIcon } from './icons';
import { useOverlays } from './overlays/site-overlays';
import { primaryButton } from './ui';

/** True once the page is scrolled past `offset` px (design: scrollTop > 480). */
function useScrolledPast(offset: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const update = () => setPast(window.scrollY > offset);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [offset]);
  return past;
}

/**
 * Bottom bar from the design. `mobileOnly` bars (program and product order) give way to the desktop layout's
 * inline controls. The bar publishes its height as `--sticky-space` on <html>, and the footer pads itself by that
 * much, so the bar never covers the last lines of the page (the product bar grows with its extras list).
 *
 * iOS 26 Safari can place `bottom: 0` about one toolbar height above the screen edge while its toolbar is minimized,
 * and page content then shows through underneath. The bar is therefore opaque (Safari tints its toolbar from it) and
 * carries a filler of its own colour below itself, which stays off-screen everywhere else.
 */
export function StickyBar({
  children,
  visible = true,
  mobileOnly = false,
  className,
}: {
  children: ReactNode;
  visible?: boolean;
  mobileOnly?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const style = document.documentElement.style;
    // Hidden by `lg:hidden` the bar measures 0, so desktop pages keep their own spacing.
    const publish = () => style.setProperty('--sticky-space', `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      style.removeProperty('--sticky-space');
    };
  }, []);

  return (
    <div
      ref={root}
      data-sticky-bar={mobileOnly ? 'mobile' : 'all'}
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-[110%]',
        mobileOnly && 'lg:hidden',
      )}
    >
      <span
        aria-hidden="true"
        data-sticky-filler=""
        className="pointer-events-none absolute inset-x-0 top-full h-[120px] bg-white"
      />
      <div
        className={cn(
          'mx-auto flex max-w-[640px] px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** "Подобрать уход за 1 минуту" on home, programs and catalog until the quiz is done (design: stickyRetail). */
export function QuizStickyBar({ always = false }: { always?: boolean }) {
  const { openQuiz, quizDone, busy } = useOverlays();
  const scrolled = useScrolledPast(480);
  if (quizDone) return null;
  return (
    <StickyBar visible={(always || scrolled) && !busy}>
      <button
        type="button"
        onClick={openQuiz}
        className={cn(
          primaryButton,
          'h-[52px] flex-1 px-[18px] text-base shadow-[0_14px_26px_-14px_var(--acsh)]',
        )}
      >
        <SparkleIcon size={18} />
        {copy.home.toQuiz}
      </button>
    </StickyBar>
  );
}

/**
 * The catalog's bottom bar (README §7.2): while the cart has products it replaces «Подобрать уход за 1 минуту»
 * with the cart count, total and «Оформить».
 */
export function CatalogBottomBar() {
  const { count, totalKgs } = useCart();
  const { openCart, busy } = useOverlays();
  const { format } = useCurrency();
  if (count === 0) return <QuizStickyBar always />;
  return (
    <StickyBar visible={!busy}>
      <button
        type="button"
        onClick={openCart}
        className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-button bg-accent pr-2 pl-4 text-left text-white shadow-[0_14px_26px_-14px_var(--acsh)] hover:brightness-[.94]"
      >
        <span className="relative flex flex-none">
          <BagIcon size={22} strokeWidth={1.9} />
          <span
            aria-hidden
            className="absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-accent-ink"
          >
            {count}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[13px] leading-[1.2]">
            {copy.cart.summary(`${count} ${itemsWord(count)}`)}
          </span>{' '}
          <span className="text-[17px] leading-[1.2] font-semibold whitespace-nowrap">
            {format(totalKgs)}
          </span>
        </span>{' '}
        <span className="flex h-10 flex-none items-center gap-1.5 rounded-button bg-black/10 px-3.5 text-[15px] font-semibold whitespace-nowrap">
          {copy.cart.checkout}
          <ArrowRightIcon size={16} />
        </span>
      </button>
    </StickyBar>
  );
}

export { useScrolledPast };
