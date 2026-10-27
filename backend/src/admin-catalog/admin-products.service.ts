import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  productInputSchema,
  slugify,
  type AdminCategory,
  type AdminProduct,
  type AdminProductRow,
  type CategoryInput,
} from '@bom/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { ApiException, invalidField, notFound } from '../common/errors';
import { adminMediaSelect, imageMediaSelect, toAdminMedia, toImageRef } from '../common/media-refs';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidateService, SITE_TAGS } from '../revalidate/revalidate.service';
import { redirectSlug, resolveSlug } from './slugs';

export interface Actor {
  userId: string;
  ip: string | null;
}

type ProductData = z.output<typeof productInputSchema>;

const rowSelect = {
  id: true,
  slug: true,
  name: true,
  volume: true,
  priceKgs: true,
  badge: true,
  inStock: true,
  published: true,
  brand: { select: { name: true } },
  category: { select: { id: true, name: true } },
  images: { orderBy: { order: 'asc' }, take: 1, select: { media: { select: imageMediaSelect } } },
  _count: { select: { programItems: true } },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  categoryId: true,
  volume: true,
  priceKgs: true,
  purpose: true,
  description: true,
  howToUse: true,
  inci: true,
  badge: true,
  inStock: true,
  published: true,
  bestseller: true,
  seoulChoice: true,
  isNew: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  brand: { select: { name: true, description: true } },
  images: { orderBy: { order: 'asc' }, select: { media: { select: adminMediaSelect } } },
  programItems: { select: { program: { select: { id: true, title: true } } } },
} satisfies Prisma.ProductSelect;

// Product changes show on product pages, program pages (item lists) and the wholesale block.
const productTags = (...slugs: string[]) => [
  SITE_TAGS.products,
  SITE_TAGS.programs,
  SITE_TAGS.content,
  ...slugs.map(SITE_TAGS.product),
];

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidator: RevalidateService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Categories

  async categories(): Promise<AdminCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, order: true, _count: { select: { products: true } } },
    });
    return rows.map(({ _count, ...row }) => ({ ...row, count: _count.products }));
  }

  async createCategory(input: CategoryInput, actor: Actor): Promise<AdminCategory> {
    const exists = await this.prisma.category.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (exists) {
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'Такая категория уже есть', {
        name: 'category.name.taken',
      });
    }
    const slug = await resolveSlug('', input.name, async (candidate) =>
      Boolean(await this.prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );
    const last = await this.prisma.category.aggregate({ _max: { order: true } });
    const row = await this.prisma.category.create({
      data: { name: input.name, slug, order: (last._max.order ?? -1) + 1 },
      select: { id: true, slug: true, name: true, order: true },
    });
    await this.audit.log({
      ...this.actorEntry(actor),
      entity: 'category',
      entityId: row.id,
      action: 'create',
    });
    this.revalidator.revalidate([SITE_TAGS.categories]);
    return { ...row, count: 0 };
  }

  async renameCategory(id: string, input: CategoryInput, actor: Actor): Promise<AdminCategory> {
    const row = await this.prisma.category.update({
      where: { id },
      data: { name: input.name },
      select: { id: true, slug: true, name: true, order: true, _count: { select: { products: true } } },
    });
    await this.audit.log({ ...this.actorEntry(actor), entity: 'category', entityId: id, action: 'update' });
    this.revalidator.revalidate([SITE_TAGS.categories, SITE_TAGS.products]);
    const { _count, ...rest } = row;
    return { ...rest, count: _count.products };
  }

  /** Only an empty category can go (design: "Удалить можно пустую категорию"). */
  async deleteCategory(id: string, actor: Actor): Promise<void> {
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'В категории есть товары', {
        id: 'category.not_empty',
      });
    }
    const deleted = await this.prisma.category.deleteMany({ where: { id } });
    if (deleted.count === 0) throw notFound('Категория не найдена');
    await this.audit.log({ ...this.actorEntry(actor), entity: 'category', entityId: id, action: 'delete' });
    this.revalidator.revalidate([SITE_TAGS.categories]);
  }

  async brands(q?: string) {
    return this.prisma.brand.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, slug: true, name: true, description: true },
    });
  }

  // Products

  async list(query: { category?: string; q?: string }): Promise<AdminProductRow[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.product.findMany({
      where: {
        ...(query.category ? { categoryId: query.category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { brand: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
      select: rowSelect,
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      brand: row.brand.name,
      category: row.category,
      volume: row.volume,
      priceKgs: row.priceKgs,
      badge: row.badge,
      inStock: row.inStock,
      published: row.published,
      image: toImageRef(row.images[0]?.media, row.name),
      programCount: row._count.programItems,
    }));
  }

  async detail(id: string): Promise<AdminProduct> {
    const row = await this.prisma.product.findUnique({ where: { id }, select: detailSelect });
    if (!row) throw notFound('Товар не найден');
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortName: row.shortName,
      brandName: row.brand.name,
      brandDescription: row.brand.description,
      categoryId: row.categoryId,
      volume: row.volume,
      priceKgs: row.priceKgs,
      purpose: row.purpose,
      description: row.description,
      howToUse: row.howToUse,
      inci: row.inci,
      badge: row.badge as AdminProduct['badge'],
      inStock: row.inStock,
      published: row.published,
      bestseller: row.bestseller,
      seoulChoice: row.seoulChoice,
      isNew: row.isNew,
      images: row.images.map((image) => toAdminMedia(image.media, this.env.MEDIA_PUBLIC_URL)),
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      programs: row.programItems.map((item) => item.program),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(input: ProductData, actor: Actor): Promise<AdminProduct> {
    const slug = await resolveSlug(input.slug, input.name, (candidate) => this.slugTaken(candidate));
    await this.checkImages(input.imageIds);
    const brandId = await this.brandId(input.brandName);
    const brandText = await this.setBrandDescription(brandId, input.brandDescription);
    const last = await this.prisma.product.aggregate({
      where: { categoryId: input.categoryId },
      _max: { order: true },
    });
    const row = await this.prisma.product.create({
      data: {
        ...this.fields(input),
        slug,
        brandId,
        order: (last._max.order ?? -1) + 1,
        images: { create: input.imageIds.map((mediaId, order) => ({ mediaId, order })) },
      },
      select: { id: true },
    });
    await this.audit.log({
      ...this.actorEntry(actor),
      entity: 'product',
      entityId: row.id,
      action: 'create',
      diff: { slug, ...(brandText ? { brandDescription: input.brandName } : {}) },
    });
    this.revalidator.revalidate([...productTags(slug), SITE_TAGS.categories]);
    this.revalidator.indexNow([`/catalog/${slug}`, '/catalog']);
    return this.detail(row.id);
  }

  async update(id: string, input: ProductData, actor: Actor): Promise<AdminProduct> {
    const current = await this.prisma.product.findUnique({ where: { id }, select: { slug: true } });
    if (!current) throw notFound('Товар не найден');
    const slug =
      input.slug && input.slug !== current.slug
        ? await resolveSlug(input.slug, input.name, (candidate) => this.slugTaken(candidate, id))
        : current.slug;
    await this.checkImages(input.imageIds);
    const brandId = await this.brandId(input.brandName);
    const brandText = await this.setBrandDescription(brandId, input.brandDescription);
    await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({ where: { productId: id } }),
      this.prisma.product.update({
        where: { id },
        data: {
          ...this.fields(input),
          slug,
          brandId,
          images: { create: input.imageIds.map((mediaId, order) => ({ mediaId, order })) },
        },
      }),
    ]);
    await redirectSlug(this.prisma, '/catalog', current.slug, slug);
    await this.audit.log({
      ...this.actorEntry(actor),
      entity: 'product',
      entityId: id,
      action: 'update',
      ...(slug !== current.slug || brandText
        ? {
            diff: {
              ...(slug !== current.slug ? { slug: { from: current.slug, to: slug } } : {}),
              ...(brandText ? { brandDescription: input.brandName } : {}),
            },
          }
        : {}),
    });
    this.revalidator.revalidate([
      ...productTags(current.slug, slug),
      SITE_TAGS.categories,
      ...(slug !== current.slug ? [SITE_TAGS.redirects] : []),
    ]);
    this.revalidator.indexNow([`/catalog/${current.slug}`, `/catalog/${slug}`]);
    return this.detail(id);
  }

  async patch(id: string, change: { inStock?: boolean; published?: boolean }, actor: Actor) {
    const row = await this.prisma.product
      .update({ where: { id }, data: change, select: { slug: true } })
      .catch(() => null);
    if (!row) throw notFound('Товар не найден');
    await this.audit.log({
      ...this.actorEntry(actor),
      entity: 'product',
      entityId: id,
      action: 'update',
      diff: change,
    });
    this.revalidator.revalidate([...productTags(row.slug), SITE_TAGS.categories]);
    if (change.published !== undefined) this.revalidator.indexNow([`/catalog/${row.slug}`, '/catalog']);
    return this.detail(id);
  }

  /**
   * Deletes the product everywhere it is shown: its programs lose it (with its routine steps; program prices stay as
   * the owner set them) and the wholesale page stops featuring it. Ordered products keep their history (order lines
   * hold the title and price).
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: { slug: true, programItems: { select: { program: { select: { slug: true } } } } },
    });
    if (!row) throw notFound('Товар не найден');
    const programs = row.programItems.map((item) => item.program.slug);
    await this.prisma.$transaction(async (tx) => {
      await tx.programItem.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      await this.unfeature(tx, id);
    });
    await this.audit.log({
      ...this.actorEntry(actor),
      entity: 'product',
      entityId: id,
      action: 'delete',
      diff: { slug: row.slug, ...(programs.length ? { programs } : {}) },
    });
    this.revalidator.revalidate([
      ...productTags(row.slug),
      SITE_TAGS.categories,
      ...programs.map(SITE_TAGS.program),
    ]);
    this.revalidator.indexNow([
      `/catalog/${row.slug}`,
      '/catalog',
      ...programs.map((slug) => `/programs/${slug}`),
    ]);
  }

  /** Drops a deleted product from the wholesale page's featured list, which would otherwise refuse to save. */
  private async unfeature(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const block = await tx.contentBlock.findUnique({ where: { key: 'wholesale' }, select: { data: true } });
    const data = block?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const featured = data.featuredProductIds;
    if (!Array.isArray(featured) || !featured.includes(productId)) return;
    await tx.contentBlock.update({
      where: { key: 'wholesale' },
      data: { data: { ...data, featuredProductIds: featured.filter((item) => item !== productId) } },
    });
  }

  private fields(input: ProductData) {
    return {
      name: input.name,
      shortName: input.shortName,
      categoryId: input.categoryId,
      volume: input.volume,
      priceKgs: input.priceKgs,
      purpose: input.purpose,
      description: input.description,
      howToUse: input.howToUse,
      inci: input.inci,
      badge: input.badge,
      inStock: input.inStock,
      published: input.published,
      bestseller: input.bestseller,
      seoulChoice: input.seoulChoice,
      isNew: input.isNew,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  private async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const row = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(row && row.id !== exceptId);
  }

  private async brandId(name: string): Promise<string> {
    const existing = await this.prisma.brand.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing.id;
    const slug = await resolveSlug('', name, async (candidate) =>
      Boolean(await this.prisma.brand.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );
    const created = await this.prisma.brand.create({
      data: { name, slug: slug || slugify(name) },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * «О бренде» lives on the brand: a product save that sends it rewrites it for every product of the brand (the
   * `products` tag the save revalidates covers their pages). Returns whether the text changed.
   */
  private async setBrandDescription(brandId: string, description: string | null): Promise<boolean> {
    if (description === null) return false;
    const changed = await this.prisma.brand.updateMany({
      where: { id: brandId, description: { not: description } },
      data: { description },
    });
    return changed.count > 0;
  }

  private async checkImages(ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw invalidField('imageIds', 'media.duplicate');
    if (!ids.length) return;
    const count = await this.prisma.media.count({ where: { id: { in: ids }, kind: 'image' } });
    if (count !== ids.length) throw invalidField('imageIds', 'media.not_found');
  }

  private actorEntry(actor: Actor) {
    return { userId: actor.userId, ip: actor.ip };
  }
}
