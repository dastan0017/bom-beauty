'use client';

import type { ImageRef } from '@bom/shared';
import { LINE_QTY_MAX } from '@bom/shared/web';
import type { Route } from 'next';
import { useRef, useState } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { useCart, type CartProduct } from '../cart/cart';
import { useCurrency } from '../currency';
import { MinusIcon, PlusIcon, TrashIcon } from '../icons';
import { useOverlays } from '../overlays/site-overlays';
import { QtyStepper } from '../overlays/form-parts';
import { StickyBar } from '../sticky-bar';
import { BackLink } from '../ui';

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

/**
 * Bottom bar of the product page (README §6.3): the quantity of this product, the other cart lines as «Добавлено к
 * заказу», and «Заказать» / «Заказать вместе» with the whole total. Nothing goes into the cart before the tap; once
 * this product is in the cart, the stepper edits its cart quantity. Sticky on phones, inline on desktop.
 */
export function ProductOrder({ product }: { product: CartProduct }) {
  const { openCart, busy } = useOverlays();
  const cart = useCart();
  const { format } = useCurrency();
  const [localQty, setLocalQty] = useState(1);
  const inCart = cart.qtyOf(product.slug);
  const qty = inCart || localQty;
  const extras = cart.lines.filter((line) => line.slug !== product.slug);
  const total = product.priceKgs * qty + extras.reduce((sum, line) => sum + line.totalKgs, 0);
  const setQty = (next: number) => (inCart ? cart.setQty(product.slug, next) : setLocalQty(next));

  const order = () => {
    if (!inCart) cart.add(product.slug, qty);
    openCart();
  };

  const controls = (
    <>
      {extras.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-muted">{copy.cart.added}</span>
          <ul className="no-scrollbar flex max-h-[156px] flex-col overflow-y-auto">
            {extras.map((line, index) => (
              <li
                key={line.slug}
                className={cn(
                  'flex min-h-[52px] flex-none items-center gap-2.5',
                  index > 0 && 'border-t border-line-2',
                )}
              >
                <span className="relative size-10 flex-none overflow-hidden rounded-[10px] bg-surface-2">
                  <BbImage image={line.image} sizes="40px" width={80} alt="" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-sm leading-[1.3] font-semibold">{line.name}</span>
                  <span className="text-[13px] whitespace-nowrap text-muted">{format(line.totalKgs)}</span>
                </span>
                <ExtraStepper
                  name={line.name}
                  qty={line.qty}
                  onChange={(next) => cart.setQty(line.slug, next)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-14 flex-none items-center rounded-button border border-line bg-white px-1">
          <QtyStepper value={qty} onChange={setQty} />
        </div>
        <button
          type="button"
          onClick={order}
          className="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-button bg-accent px-3.5 text-white shadow-[0_0_0_6px_var(--halo),0_14px_26px_-14px_var(--acsh)] hover:brightness-[.94] active:brightness-[.88]"
        >
          <span className="text-[13px] leading-[1.2] font-medium whitespace-nowrap">
            {extras.length ? copy.cart.orderTogether : copy.cart.order}
          </span>
          <span className="text-[17px] leading-[1.2] font-semibold whitespace-nowrap">{format(total)}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="mt-6 hidden flex-col gap-2.5 lg:flex">{controls}</div>
      <StickyBar mobileOnly visible={!busy} className="flex-col gap-2.5 pt-3">
        {controls}
      </StickyBar>
    </>
  );
}

/** − / + of an extra line; at 1 the minus is a bin that removes it from the order. */
function ExtraStepper({
  name,
  qty,
  onChange,
}: {
  name: string;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const round =
    'flex size-10 flex-none items-center justify-center rounded-full border border-line bg-white text-ink disabled:opacity-40';
  return (
    <div className="flex flex-none items-center gap-0.5" role="group" aria-label={name}>
      <button
        type="button"
        aria-label={qty === 1 ? copy.order.remove : copy.cart.less}
        className={cn(round, qty === 1 && 'text-muted')}
        onClick={() => onChange(qty - 1)}
      >
        {qty === 1 ? <TrashIcon size={14} /> : <MinusIcon size={13} strokeWidth={2.6} />}
      </button>
      <span aria-live="polite" className="min-w-6 text-center text-[15px] font-semibold">
        {qty}
      </span>
      <button
        type="button"
        aria-label={copy.cart.more}
        className={round}
        disabled={qty >= LINE_QTY_MAX}
        onClick={() => onChange(qty + 1)}
      >
        <PlusIcon size={13} strokeWidth={2.6} />
      </button>
    </div>
  );
}
