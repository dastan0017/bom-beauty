'use client';

import type { ImageRef } from '@bom/shared';
import type { Route } from 'next';
import { useRef, useState } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { useCurrency } from '../currency';
import { useOverlays, type OrderItem } from '../overlays/site-overlays';
import { QtyStepper } from '../overlays/form-parts';
import { StickyBar } from '../sticky-bar';
import { BackLink, primaryButton } from '../ui';

/** "Каталог", or "К программе" when the visitor came from a program page (design: prodBackLabel). */
export function ProductBackLink() {
  const { previousPath } = useOverlays();
  const fromProgram = previousPath?.startsWith('/programs/') ? previousPath : null;
  return (
    <BackLink href={(fromProgram ?? '/catalog') as Route} className="self-start px-1">
      {fromProgram ? copy.product.backTo.program : copy.product.backTo.catalog}
    </BackLink>
  );
}

/** Swipeable photo gallery with dots (design: gallery / gdots). */
export function ProductGallery({ images, name }: { images: ImageRef[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const slides: (ImageRef | null)[] = images.length ? images : [null];

  return (
    <div>
      <div
        ref={track}
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          const index = Math.round(scrollLeft / Math.max(1, clientWidth));
          if (index !== active) setActive(index);
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-card border border-line bg-surface"
        role="region"
        aria-roledescription="carousel"
        aria-label={copy.product.gallery}
        // Arrow keys scroll the gallery (snapping to each photo) when it has focus.
        tabIndex={slides.length > 1 ? 0 : undefined}
      >
        {slides.map((image, index) => (
          <div
            key={image?.id ?? 'empty'}
            className="relative flex aspect-square flex-[0_0_100%] snap-start items-center justify-center bg-surface-2"
            aria-label={copy.product.photoOf(index + 1)}
            role="group"
          >
            <BbImage
              image={image}
              sizes="(min-width: 1024px) 520px, 100vw"
              width={640}
              alt={image?.alt || name}
              priority={index === 0}
              placeholder={<PhotoPlaceholder label={copy.common.productPhoto} className="text-xs" />}
            />
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-3">
          {/* Dots are a pointer shortcut, as in the design; keyboards scroll the focused gallery. */}
          {slides.map((image, index) => (
            <span
              key={image?.id ?? index}
              aria-hidden="true"
              onClick={() => {
                const element = track.current;
                if (element) element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' });
              }}
              className="flex h-6 cursor-pointer items-center"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-[width] duration-200',
                  index === active ? 'w-[18px] bg-ink' : 'w-1.5 bg-line-hover',
                )}
              />
            </span>
          ))}
          <span className="sr-only" aria-live="polite">
            {copy.product.photoOf(active + 1)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Quantity and "Заказать · price": sticky bar on phones, inline block on desktop (design: isProduct bar). */
export function ProductOrder({ item }: { item: OrderItem }) {
  const { openOrder, busy } = useOverlays();
  const { format } = useCurrency();
  const [qty, setQty] = useState(1);

  const controls = (
    <>
      <div className="flex h-14 flex-none items-center rounded-button border border-line bg-white px-1">
        <QtyStepper value={qty} onChange={setQty} />
      </div>
      <button
        type="button"
        onClick={() => openOrder(item, { qty })}
        className={cn(primaryButton, 'h-14 flex-1 px-3.5 text-base')}
      >
        <span className="whitespace-nowrap">{copy.product.orderFor(format(item.priceKgs * qty))}</span>
      </button>
    </>
  );

  return (
    <>
      <div className="mt-6 hidden items-center gap-3 lg:flex">{controls}</div>
      <StickyBar mobileOnly visible={!busy} className="items-center gap-3 pt-3">
        {controls}
      </StickyBar>
    </>
  );
}
