'use client';

import type { ReviewCard } from '@bom/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { srcSet, variantUrl, pickWidth } from '@/lib/media';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchIcon } from '../icons';
import { useModal, usePresence } from '../overlays/use-dialog';

const CARD = 230;
const GAP = 14;
const STEP = CARD + GAP;

/** Look of a screenshot card by its aspect ratio (design: REV_LOOK). */
function look(review: ReviewCard) {
  const ratio = review.image.height / review.image.width;
  return {
    cover: ratio >= 1.5,
    fade: ratio > 1.85,
  };
}

/** Reviews carousel with the centred card in focus, dots or a counter, and a lightbox (design: revs). */
export function Reviews({ reviews }: { reviews: ReviewCard[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const count = reviews.length;

  const go = (index: number) => {
    const next = Math.max(0, Math.min(count - 1, index));
    track.current?.scrollTo({ left: next * STEP, behavior: 'smooth' });
    setActive(next);
  };

  return (
    <>
      <div
        ref={track}
        onScroll={(event) => {
          const index = Math.round(event.currentTarget.scrollLeft / STEP);
          if (index !== active) setActive(Math.max(0, Math.min(count - 1, index)));
        }}
        className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto pt-3.5 pb-6"
      >
        <div aria-hidden="true" className="w-[calc(50%-129px)] flex-none" />
        {reviews.map((review, index) => {
          const offset = index - active;
          const { cover, fade } = look(review);
          return (
            <button
              key={review.id}
              type="button"
              onClick={() => (index === active ? setLightbox(index) : go(index))}
              className={cn(
                'relative h-[400px] w-[230px] flex-none snap-center overflow-hidden rounded-[22px] transition-[transform,opacity,box-shadow] duration-[350ms]',
                cover ? 'bg-white' : 'bg-surface-2',
                offset === 0
                  ? 'opacity-100 shadow-[0_26px_44px_-20px_rgba(19,35,63,.5)]'
                  : 'scale-[.88] opacity-55 shadow-[0_10px_24px_-18px_rgba(19,35,63,.35)]',
                offset < 0 && '-rotate-3',
                offset > 0 && 'rotate-3',
              )}
            >
              <picture>
                <source type="image/avif" srcSet={srcSet(review.image, 'avif')} sizes="230px" />
                <source type="image/webp" srcSet={srcSet(review.image, 'webp')} sizes="230px" />
                <img
                  src={variantUrl(review.image.id, pickWidth(review.image, 460), 'webp')}
                  alt={`${review.image.alt || copy.home.reviewAlt}. ${copy.home.reviewOf(index + 1, count)}`}
                  width={review.image.width}
                  height={review.image.height}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    'block size-full',
                    cover ? 'object-cover object-top' : 'object-contain object-center',
                  )}
                />
              </picture>
              {fade && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.97))]" />
              )}
              <span className="pointer-events-none absolute bottom-3.5 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-[rgba(19,35,63,.84)] px-3 text-[13px] font-semibold whitespace-nowrap text-white">
                <SearchIcon size={14} />
                {copy.home.reviewOpen}
              </span>
            </button>
          );
        })}
        <div aria-hidden="true" className="w-[calc(50%-129px)] flex-none" />
      </div>
      <div className="flex items-center justify-center gap-[18px]">
        <RoundButton label={copy.home.reviewsPrev} onClick={() => go(active - 1)} disabled={active === 0}>
          <ChevronLeftIcon size={18} />
        </RoundButton>
        <div className="flex items-center gap-1.5">
          {count <= 8 ? (
            <>
              {/* Dots are a pointer shortcut, as in the design; keyboards and screen readers use the arrows. */}
              {reviews.map((review, index) => (
                <span
                  key={review.id}
                  aria-hidden="true"
                  onClick={() => go(index)}
                  className="flex h-6 cursor-pointer items-center"
                >
                  <span
                    className={cn(
                      'block h-1.5 rounded-full transition-[width] duration-[250ms]',
                      index === active ? 'w-[18px] bg-ink' : 'w-1.5 bg-line-hover',
                    )}
                  />
                </span>
              ))}
              <span className="sr-only" aria-live="polite">
                {copy.home.reviewOf(active + 1, count)}
              </span>
            </>
          ) : (
            <span className="min-w-14 text-center text-[15px] font-semibold" aria-live="polite">
              {active + 1} / {count}
            </span>
          )}
        </div>
        <RoundButton
          label={copy.home.reviewsNext}
          onClick={() => go(active + 1)}
          disabled={active >= count - 1}
        >
          <ChevronRightIcon size={18} />
        </RoundButton>
      </div>
      <Lightbox reviews={reviews} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
    </>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Lightbox({
  reviews,
  index,
  onIndex,
  onClose,
}: {
  reviews: ReviewCard[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const open = index !== null;
  const { mounted, visible } = usePresence(open, 200);
  const panel = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(index ?? 0);
  useModal(panel, open, onClose);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the last image during the fade-out
    if (index !== null) setShown(index);
  }, [index]);

  if (!mounted) return null;
  const review = reviews[shown];
  if (!review) return null;
  const count = reviews.length;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={copy.home.reviewOf(shown + 1, count)}
      tabIndex={-1}
      onClick={onClose}
      className={cn(
        'fixed inset-0 z-50 flex cursor-zoom-out flex-col bg-[rgba(10,12,26,.95)] transition-opacity duration-200 outline-none',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="flex items-center justify-between gap-3 pt-[calc(12px+env(safe-area-inset-top))] pr-4 pb-2.5 pl-5">
        <span className="text-[15px] font-semibold text-white">{copy.home.reviewOf(shown + 1, count)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.common.close}
          data-autofocus
          className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-5 pt-1.5 pb-4">
        <picture onClick={(event) => event.stopPropagation()} className="self-start">
          <source type="image/avif" srcSet={srcSet(review.image, 'avif')} sizes="380px" />
          <source type="image/webp" srcSet={srcSet(review.image, 'webp')} sizes="380px" />
          <img
            src={variantUrl(review.image.id, pickWidth(review.image, 760), 'webp')}
            alt={review.image.alt || copy.home.reviewAlt}
            width={review.image.width}
            height={review.image.height}
            className="block h-auto w-full max-w-[380px] cursor-default rounded-[18px]"
          />
        </picture>
      </div>
      <div
        className="flex items-center justify-center gap-4 px-4 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={copy.home.reviewsPrev}
          disabled={shown === 0}
          onClick={() => onIndex(shown - 1)}
          className="flex size-[52px] items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-40"
        >
          <ChevronLeftIcon size={22} />
        </button>
        <button
          type="button"
          aria-label={copy.home.reviewsNext}
          disabled={shown >= count - 1}
          onClick={() => onIndex(shown + 1)}
          className="flex size-[52px] items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-40"
        >
          <ChevronRightIcon size={22} />
        </button>
      </div>
    </div>
  );
}
