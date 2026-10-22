'use client';

import { LINE_QTY_MAX, waLink } from '@bom/shared/web';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { MinusIcon, PlusIcon } from '../icons';
import { useOverlays } from '../overlays/site-overlays';
import { outlineButton } from '../ui';
import { useCart } from './cart';

/**
 * «В корзину» on product cards; once the product is in the cart it becomes a stepper ("N шт."), and going to 0
 * removes it (README §1.5). Rendered as a wa.me link first, so ordering works before hydration or without JavaScript.
 */
export function AddToCart({
  slug,
  name,
  size = 'rail',
  label = copy.cart.add,
}: {
  slug: string;
  name: string;
  /** rail: 40 px (home rails, «С этим средством ещё берут»); card: 44 px (catalog grid). */
  size?: 'rail' | 'card';
  label?: string;
}) {
  const { whatsapp } = useOverlays();
  const { qtyOf, add, setQty } = useCart();
  const qty = qtyOf(slug);
  const height = size === 'card' ? 'h-11' : 'h-10';

  if (qty === 0) {
    return (
      <a
        href={waLink(whatsapp, `${copy.whatsappFallback}: ${name}`)}
        target="_blank"
        rel="noopener noreferrer"
        role="button"
        onClick={(event) => {
          event.preventDefault();
          add(slug);
        }}
        className={cn(
          outlineButton,
          height,
          'tap mt-2.5 active:bg-surface-2',
          size === 'card' ? 'text-[15px]' : 'text-sm',
        )}
      >
        {label}
      </a>
    );
  }

  const round = cn(
    'tap flex flex-none items-center justify-center rounded-full bg-surface text-ink disabled:opacity-40',
    size === 'card' ? 'size-[38px]' : 'size-[34px]',
  );
  return (
    <div
      role="group"
      aria-label={copy.cart.inCart(name, qty)}
      className={cn(
        'mt-2.5 flex items-center justify-between rounded-button bg-accent-soft px-[3px]',
        height,
      )}
    >
      <button
        type="button"
        aria-label={copy.cart.less}
        className={round}
        onClick={() => setQty(slug, qty - 1)}
      >
        <MinusIcon size={14} strokeWidth={2.6} />
      </button>
      <span aria-live="polite" className="text-[15px] font-semibold whitespace-nowrap text-accent-ink">
        {copy.cart.units(qty)}
      </span>
      <button
        type="button"
        aria-label={copy.cart.more}
        className={round}
        disabled={qty >= LINE_QTY_MAX}
        onClick={() => setQty(slug, qty + 1)}
      >
        <PlusIcon size={14} strokeWidth={2.6} />
      </button>
    </div>
  );
}
