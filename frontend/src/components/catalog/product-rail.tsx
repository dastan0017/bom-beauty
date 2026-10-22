import type { ProductCard } from '@bom/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { AddToCart } from '../cart/add-to-cart';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { Price } from '../currency';
import { ArrowRightIcon } from '../icons';
import { card } from '../ui';
import { ProductBadge } from './product-card';

/** 164 px product card of the horizontal rails (design: bestRail, freshRail, seoulRail, relRail). */
export function RailCard({ product, buttonLabel }: { product: ProductCard; buttonLabel?: string }) {
  return (
    <article
      className={cn(card, 'flex w-[164px] flex-none snap-start flex-col px-2 pt-2 pb-2.5 lg:w-[200px]')}
    >
      <Link href={`/catalog/${product.slug}`} className="flex flex-1 flex-col">
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[calc(var(--rc)-8px)] bg-surface-2">
          <BbImage
            image={product.image}
            sizes="(min-width: 1024px) 200px, 164px"
            width={320}
            alt={product.name}
            placeholder={<PhotoPlaceholder label={copy.common.productPhoto} />}
          />
          {product.badge && <ProductBadge label={product.badge} />}
        </span>
        <span className="flex flex-1 flex-col px-1 pt-2.5">
          <span className="text-[13px] text-muted">{product.brand}</span>
          <span className="mt-0.5 text-[15px] leading-[1.3] font-semibold">{product.name}</span>
          <span className="mt-auto pt-2.5 text-base font-semibold tracking-[-0.01em] whitespace-nowrap">
            <Price kgs={product.priceKgs} />
          </span>
        </span>
      </Link>
      <AddToCart slug={product.slug} name={product.name} {...(buttonLabel ? { label: buttonLabel } : {})} />
    </article>
  );
}

/** Horizontal, snapping product scroller with a title row (README §1.5, §6.1). Hidden when the list is empty. */
export function ProductRail({
  title,
  products,
  link = true,
  buttonLabel,
  className,
  titleClassName,
}: {
  title: ReactNode;
  products: ProductCard[];
  /** «Каталог →» next to the title. */
  link?: boolean;
  buttonLabel?: string;
  className?: string;
  titleClassName?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className={cn('mx-auto flex w-full max-w-[1100px] flex-col gap-3.5', className)}>
      <div className="flex items-end justify-between gap-3 px-5 lg:px-6">
        <h2
          className={cn(
            'min-w-0 heading text-[calc(26px*var(--fhk))] leading-[1.15] lg:text-[calc(32px*var(--fhk))]',
            titleClassName,
          )}
        >
          {title}
        </h2>
        {link && (
          <Link
            href="/catalog"
            className="inline-flex h-11 flex-none items-center gap-1 text-[15px] font-semibold whitespace-nowrap text-accent-ink"
          >
            {copy.home.toCatalog}
            <ArrowRightIcon size={16} />
          </Link>
        )}
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 lg:scroll-px-6 lg:px-6">
        {products.map((product) => (
          <RailCard key={product.slug} product={product} {...(buttonLabel ? { buttonLabel } : {})} />
        ))}
      </div>
    </section>
  );
}
