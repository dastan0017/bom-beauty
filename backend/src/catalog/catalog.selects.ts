import type { ProductCard } from '@bom/shared';
import type { Prisma } from '../generated/prisma/client';
import { imageMediaSelect, toImageRef } from '../common/media-refs';

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  volume: true,
  purpose: true,
  priceKgs: true,
  badge: true,
  inStock: true,
  brand: { select: { name: true } },
  category: { select: { slug: true, name: true } },
  images: { orderBy: { order: 'asc' }, take: 1, select: { alt: true, media: { select: imageMediaSelect } } },
} satisfies Prisma.ProductSelect;
export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export function toProductCard(row: ProductCardRow): ProductCard {
  const main = row.images[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName ?? row.name,
    brand: row.brand.name,
    category: row.category,
    volume: row.volume,
    purpose: row.purpose,
    priceKgs: row.priceKgs,
    badge: row.badge,
    inStock: row.inStock,
    image: toImageRef(main?.media, main?.alt || row.name),
  };
}

/** Catalog order: category order, then the product's own order, then name. */
export const productOrder = [
  { category: { order: 'asc' } },
  { order: 'asc' },
  { name: 'asc' },
] satisfies Prisma.ProductOrderByWithRelationInput[];
