import { Inject, Injectable } from '@nestjs/common';
import type {
  Brand,
  Category,
  ProductCard,
  ProductDetail,
  ProgramCard,
  ProgramDetail,
  RoutineStep,
  Sitemap,
} from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { notFound } from '../common/errors';
import {
  fileMediaSelect,
  imageMediaSelect,
  toFileRef,
  toImageRef,
  toVideoRef,
  videoSelect,
} from '../common/media-refs';
import { PrismaService } from '../prisma/prisma.service';
import { productCardSelect, productOrder, toProductCard, type ProductCardRow } from './catalog.selects';

const RELATED_MAX = 6;

/** The product page also shows «О бренде». */
const brandWithDescription = { select: { name: true, description: true } } as const;

const programCardSelect = {
  id: true,
  slug: true,
  title: true,
  symptom: true,
  badge: true,
  priceKgs: true,
  inStock: true,
  quizGoal: true,
  quizSkins: true,
  video: { select: videoSelect },
  cover: { select: imageMediaSelect },
  items: {
    orderBy: { order: 'asc' },
    select: {
      product: {
        select: {
          slug: true,
          name: true,
          images: {
            orderBy: { order: 'asc' },
            take: 1,
            select: { alt: true, media: { select: imageMediaSelect } },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async categories(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, _count: { select: { products: { where: { published: true } } } } },
    });
    return rows.map((row) => ({ slug: row.slug, name: row.name, count: row._count.products }));
  }

  async products(category?: string): Promise<ProductCard[]> {
    const rows = await this.prisma.product.findMany({
      where: { published: true, ...(category ? { category: { slug: category } } : {}) },
      orderBy: productOrder,
      select: productCardSelect,
    });
    return rows.map(toProductCard);
  }

  async product(slug: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { slug, published: true },
      select: {
        ...productCardSelect,
        brand: brandWithDescription,
        description: true,
        howToUse: true,
        inci: true,
        seoTitle: true,
        seoDescription: true,
        updatedAt: true,
        images: { orderBy: { order: 'asc' }, select: { alt: true, media: { select: imageMediaSelect } } },
        programItems: {
          where: { program: { published: true } },
          orderBy: [{ program: { order: 'asc' } }, { program: { title: 'asc' } }],
          select: {
            program: {
              select: {
                slug: true,
                title: true,
                items: {
                  where: { product: { published: true } },
                  orderBy: { order: 'asc' },
                  select: { product: { select: productCardSelect } },
                },
              },
            },
          },
        },
      },
    });
    if (!row) throw notFound();
    const related = await this.related(
      row.id,
      row.programItems.flatMap((item) => item.program.items.map(({ product }) => product)),
    );
    const images = row.images.flatMap((image) => {
      const ref = toImageRef(image.media, image.alt || row.name);
      return ref ? [ref] : [];
    });
    return {
      ...toProductCard(row),
      brandDescription: row.brand.description,
      description: row.description,
      howToUse: row.howToUse,
      inci: row.inci,
      images,
      programs: row.programItems.map(({ program }) => ({ slug: program.slug, title: program.title })),
      related,
      seo: { title: row.seoTitle, description: row.seoDescription },
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * «С этим средством ещё берут» (README §6.1): the other products of the programs that contain this one, in program
   * order, then the «Бестселлеры» and «Выбор клиник Сеула» rails; up to 6, no repeats.
   */
  private async related(productId: string, fromPrograms: ProductCardRow[]): Promise<ProductCard[]> {
    const picked = new Map<string, ProductCardRow>();
    const add = (product: ProductCardRow) => {
      if (picked.size < RELATED_MAX && product.id !== productId && !picked.has(product.id))
        picked.set(product.id, product);
    };
    fromPrograms.forEach(add);
    if (picked.size < RELATED_MAX) {
      const rails = await this.prisma.product.findMany({
        where: { published: true, id: { not: productId }, OR: [{ bestseller: true }, { seoulChoice: true }] },
        orderBy: productOrder,
        select: productCardSelect,
      });
      rails.filter((product) => product.bestseller).forEach(add);
      rails.filter((product) => product.seoulChoice).forEach(add);
    }
    return [...picked.values()].map(toProductCard);
  }

  async programs(): Promise<ProgramCard[]> {
    const rows = await this.prisma.program.findMany({
      where: { published: true },
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
      select: programCardSelect,
    });
    return rows.map((row) => this.toProgramCard(row));
  }

  async program(slug: string): Promise<ProgramDetail> {
    const row = await this.prisma.program.findFirst({
      where: { slug, published: true },
      select: {
        ...programCardSelect,
        headline: true,
        course: true,
        fit: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        updatedAt: true,
        protocol: { select: fileMediaSelect },
        items: { orderBy: { order: 'asc' }, select: { product: { select: productCardSelect } } },
        steps: {
          orderBy: { order: 'asc' },
          select: {
            period: true,
            text: true,
            product: { select: { slug: true, name: true, shortName: true } },
          },
        },
      },
    });
    if (!row) throw notFound();

    const items = row.items.map((item) => toProductCard(item.product));
    const step = (s: (typeof row.steps)[number]): RoutineStep => ({
      productSlug: s.product.slug,
      title: s.product.shortName ?? s.product.name,
      text: s.text,
    });
    const card = this.toProgramCard(row);

    return {
      ...card,
      headline: row.headline,
      course: row.course,
      fit: row.fit,
      description: row.description,
      items,
      sumKgs: items.reduce((sum, item) => sum + item.priceKgs, 0),
      steps: {
        am: row.steps.filter((s) => s.period === 'am').map(step),
        pm: row.steps.filter((s) => s.period === 'pm').map(step),
      },
      video: toVideoRef(row.video),
      protocol: toFileRef(row.protocol, this.env.MEDIA_PUBLIC_URL),
      seo: { title: row.seoTitle, description: row.seoDescription },
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async brands(): Promise<Brand[]> {
    return this.prisma.brand.findMany({
      where: { products: { some: { published: true } } },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
  }

  async sitemap(): Promise<Sitemap> {
    const [programs, products] = await Promise.all([
      this.prisma.program.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.product.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    ]);
    const iso = (rows: { slug: string; updatedAt: Date }[]) =>
      rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
    return { programs: iso(programs), products: iso(products) };
  }

  private toProgramCard(row: {
    id: string;
    slug: string;
    title: string;
    symptom: string;
    badge: string | null;
    priceKgs: number;
    inStock: boolean;
    quizGoal: ProgramCard['quiz']['goal'];
    quizSkins: ProgramCard['quiz']['skins'];
    video: Parameters<typeof toVideoRef>[0];
    cover: Parameters<typeof toImageRef>[0];
    items: {
      product: {
        slug: string;
        name: string;
        images: { alt: string; media: Parameters<typeof toImageRef>[0] }[];
      };
    }[];
  }): ProgramCard {
    const video = toVideoRef(row.video);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      symptom: row.symptom,
      badge: row.badge,
      priceKgs: row.priceKgs,
      inStock: row.inStock,
      itemCount: row.items.length,
      thumbs: row.items.map(({ product }) => ({
        slug: product.slug,
        image: toImageRef(product.images[0]?.media, product.images[0]?.alt || product.name),
      })),
      cover: toImageRef(row.cover, row.title),
      video: video ? { durationSec: video.durationSec, poster: video.poster } : null,
      quiz: { goal: row.quizGoal, skins: row.quizSkins },
    };
  }
}
