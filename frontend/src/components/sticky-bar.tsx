'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { SparkleIcon } from './icons';
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
 * inline controls; the footer reserves space for whichever bar is present (globals.css, [data-sticky-bar]).
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
  return (
    <div
      data-sticky-bar={mobileOnly ? 'mobile' : 'all'}
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/97 backdrop-blur-sm transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-[110%]',
        mobileOnly && 'lg:hidden',
      )}
    >
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

export { useScrolledPast };
