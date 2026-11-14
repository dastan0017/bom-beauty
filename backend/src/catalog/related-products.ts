import { PRODUCT_RELATED_MAX } from '@bom/shared';
import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { productCardSelect, productOrder, type ProductCardRow } from './catalog.selects';

/** The published products of the published programs that list this one, in program order. */
export const programmedWithSelect = {
  where: { program: { published: true } },
  orderBy: [{ program: { order: 'asc' } }, { program: { title: 'asc' } }],
  select: {
    program: {
      select: {
        items: {
          where: { product: { published: true } },
          orderBy: { order: 'asc' },
          select: { product: { select: productCardSelect } },
        },
      },
    },
  },
} satisfies Prisma.ProgramItemFindManyArgs;

/** The owner's picks for «С этим средством ещё берут» (D49) that are on the site, in their order. */
export const chosenRelatedSelect = {
  where: { related: { published: true } },
  orderBy: { order: 'asc' },
  take: PRODUCT_RELATED_MAX,
  select: { related: { select: productCardSelect } },
} satisfies Prisma.ProductRelatedFindManyArgs;

/**
 * What the site picks for «С этим средством ещё берут» when the owner chose nothing (README §6.1): the other products
 * of the programs that contain this one, in program order, then the «Бестселлеры» and «Выбор клиник Сеула» rails; up
 * to PRODUCT_RELATED_MAX, no repeats.
 */
export async function autoRelated(
  prisma: PrismaService,
  productId: string,
  fromPrograms: readonly ProductCardRow[],
): Promise<ProductCardRow[]> {
  const picked = new Map<string, ProductCardRow>();
  const add = (product: ProductCardRow) => {
    if (picked.size < PRODUCT_RELATED_MAX && product.id !== productId && !picked.has(product.id))
      picked.set(product.id, product);
  };
  fromPrograms.forEach(add);
  if (picked.size < PRODUCT_RELATED_MAX) {
    const rails = await prisma.product.findMany({
      where: { published: true, id: { not: productId }, OR: [{ bestseller: true }, { seoulChoice: true }] },
      orderBy: productOrder,
      select: productCardSelect,
    });
    rails.filter((product) => product.bestseller).forEach(add);
    rails.filter((product) => product.seoulChoice).forEach(add);
  }
  return [...picked.values()];
}

/** autoRelated for a product the caller has not loaded with its programs (the admin editor's preview). */
export async function autoRelatedOf(prisma: PrismaService, productId: string): Promise<ProductCardRow[]> {
  const items = await prisma.programItem.findMany({
    ...programmedWithSelect,
    where: { productId, ...programmedWithSelect.where },
  });
  return autoRelated(
    prisma,
    productId,
    items.flatMap((item) => item.program.items.map(({ product }) => product)),
  );
}
