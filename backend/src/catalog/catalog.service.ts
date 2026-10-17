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
import { productCardSelect, productOrder, toProductCard } from './catalog.selects';

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
        description: true,
        howToUse: true,
        inci: true,
        seoTitle: true,
        seoDescription: true,
        updatedAt: true,
        images: { orderBy: { order: 'asc' }, select: { alt: true, media: { select: imageMediaSelect } } },
        programItems: {
          where: { program: { published: true } },
          orderBy: { program: { order: 'asc' } },
          select: { program: { select: { slug: true, title: true } } },
        },
      },
    });
    if (!row) throw notFound();
    const images = row.images.flatMap((image) => {
      const ref = toImageRef(image.media, image.alt || row.name);
      return ref ? [ref] : [];
    });
    return {
      ...toProductCard(row),
      description: row.description,
      howToUse: row.howToUse,
      inci: row.inci,
      images,
      programs: row.programItems.map((item) => item.program),
      seo: { title: row.seoTitle, description: row.seoDescription },
      updatedAt: row.updatedAt.toISOString(),
    };
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
      video: video ? { durationSec: video.durationSec, poster: video.poster } : null,
      quiz: { goal: row.quizGoal, skins: row.quizSkins },
    };
  }
}
