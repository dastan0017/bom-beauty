import type { ProductCard as ProductCardData } from '@bom/shared';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { AddToCart } from '../cart/add-to-cart';
import { ProductVideoButton } from './product-client';
import type { CartProduct } from '../cart/cart';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { Price } from '../currency';
import { SparkleIcon } from '../icons';
import { card } from '../ui';

/** What the cart keeps of a product (no blur placeholder, to keep every page's payload small). */
export const cartProduct = (product: ProductCardData): CartProduct => ({
  slug: product.slug,
  name: product.name,
  brand: product.brand,
  volume: product.volume,
  priceKgs: product.priceKgs,
  image: product.image ? { ...product.image, blurDataUrl: null } : null,
});

/** White badge on a product photo: «Новинка» or the product's own label (design: bdg). */
export function ProductBadge({ label }: { label: string }) {
  return (
    <span className="absolute top-2 left-2 z-[1] inline-flex h-6 items-center gap-1 rounded-full bg-surface px-[9px] text-xs font-semibold whitespace-nowrap text-accent-ink shadow-[0_2px_8px_rgba(14,14,44,.12)]">
      <SparkleIcon size={10} />
      {label}
    </span>
  );
}

/** Catalog grid card (design: isCatalog → items). */
export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <article className={cn(card, 'relative flex flex-col px-2 pt-2 pb-2.5')}>
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
          {product.badge && <ProductBadge label={product.badge} />}
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
      {product.video && <ProductVideoButton product={cartProduct(product)} video={product.video} />}
      <AddToCart slug={product.slug} name={product.name} size="card" />
    </article>
  );
}
