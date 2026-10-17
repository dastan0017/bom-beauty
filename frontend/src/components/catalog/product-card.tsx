import type { ProductCard as ProductCardData } from '@bom/shared';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { Price } from '../currency';
import { SparkleIcon } from '../icons';
import { card, outlineButton } from '../ui';
import { OrderButton } from './order-button';

export const productOrderItem = (product: ProductCardData) => ({
  type: 'product' as const,
  slug: product.slug,
  title: product.name,
  meta: `${product.brand} · ${product.volume}`,
  priceKgs: product.priceKgs,
  image: product.image,
});

/** Catalog grid card (design: isCatalog → items). */
export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <article className={cn(card, 'flex flex-col px-2 pt-2 pb-2.5')}>
      <Link href={`/catalog/${product.slug}`} className="flex flex-1 flex-col">
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[calc(var(--rc)-8px)] bg-surface-2">
          <BbImage
            image={product.image}
            sizes="(min-width: 1024px) 250px, (min-width: 768px) 33vw, 50vw"
            width={320}
            alt={product.name}
            priority={priority}
            placeholder={<PhotoPlaceholder label={copy.common.productPhoto} />}
          />
          {product.badge && (
            <span className="absolute top-2 left-2 z-[1] inline-flex h-6 items-center gap-1 rounded-full bg-surface px-[9px] text-xs font-semibold whitespace-nowrap text-accent-ink shadow-[0_2px_8px_rgba(14,14,44,.12)]">
              <SparkleIcon size={10} />
              {product.badge}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col px-1.5 pt-3">
          <span className="text-[13px] text-muted">{product.brand}</span>
          <span className="mt-[3px] text-base leading-[1.3] font-semibold">{product.name}</span>
          <span className="mt-1 text-sm leading-[1.4] text-muted">{product.purpose}</span>
          <span className="mt-auto pt-3 text-[17px] font-semibold tracking-[-0.01em] whitespace-nowrap">
            <Price kgs={product.priceKgs} />
          </span>
        </span>
      </Link>
      <OrderButton
        item={productOrderItem(product)}
        className={cn(outlineButton, 'mt-2.5 h-11 text-[15px] active:bg-surface-2')}
      >
        {copy.common.order}
      </OrderButton>
    </article>
  );
}
