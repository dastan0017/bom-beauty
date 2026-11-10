import { Inject, Injectable } from '@nestjs/common';
import {
  EXTRA_PROGRAM_VARIANTS,
  programInputSchema,
  type AdminProgram,
  type AdminProgramItem,
  type AdminProgramRow,
  type ExtraProgramVariant,
  type ProgramVariant,
} from '@bom/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { invalidField, notFound } from '../common/errors';
import {
  adminMediaSelect,
  adminVideoSelect,
  imageMediaSelect,
  toAdminMedia,
  toAdminVideo,
  toImageRef,
} from '../common/media-refs';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import type { Prisma } from '../generated/prisma/client';
import { offeredVariants } from '../catalog/program-variants';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidateService, SITE_TAGS } from '../revalidate/revalidate.service';
import type { Actor } from './admin-products.service';
import { redirectSlug, resolveSlug } from './slugs';

type ProgramData = z.output<typeof programInputSchema>;

const itemProductSelect = {
  id: true,
  name: true,
  shortName: true,
  volume: true,
  priceKgs: true,
  brand: { select: { name: true } },
  images: { orderBy: { order: 'asc' }, take: 1, select: { media: { select: imageMediaSelect } } },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  id: true,
  slug: true,
  title: true,
  headline: true,
  symptom: true,
  description: true,
  course: true,
  fit: true,
  priceKgs: true,
  miniPriceKgs: true,
  maxPriceKgs: true,
  badge: true,
  quizGoal: true,
  quizSkins: true,
  published: true,
  inStock: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  items: { orderBy: { order: 'asc' }, select: { variant: true, product: { select: itemProductSelect } } },
  steps: {
    orderBy: [{ period: 'asc' }, { order: 'asc' }],
    select: { period: true, productId: true, text: true },
  },
  video: { select: adminVideoSelect },
  protocol: { select: adminMediaSelect },
  cover: { select: adminMediaSelect },
} satisfies Prisma.ProgramSelect;

// Program changes show on the home grid, the programs list, the program page, product pages ("Входит в программы"),
// the catalog's problem filter and the quiz.
const programTags = (...slugs: string[]) => [
  SITE_TAGS.programs,
  SITE_TAGS.products,
  ...slugs.map(SITE_TAGS.program),
];

@Injectable()
export class AdminProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidator: RevalidateService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(): Promise<AdminProgramRow[]> {
    const rows = await this.prisma.program.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        symptom: true,
        badge: true,
        priceKgs: true,
        miniPriceKgs: true,
        maxPriceKgs: true,
        published: true,
        inStock: true,
        quizGoal: true,
        video: { select: { status: true } },
        protocol: { select: { status: true } },
        // Every variant's items: the row shows «Стандарт»'s and names the variants on offer.
        items: {
          orderBy: { order: 'asc' },
          select: {
            variant: true,
            product: {
              select: {
                name: true,
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                  select: { media: { select: imageMediaSelect } },
                },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => {
      const standard = row.items.filter((item) => item.variant === 'standard');
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        symptom: row.symptom,
        badge: row.badge,
        priceKgs: row.priceKgs,
        itemCount: standard.length,
        published: row.published,
        inStock: row.inStock,
        quizGoal: row.quizGoal,
        videoStatus: row.video?.status ?? null,
        protocolStatus: row.protocol?.status ?? null,
        thumbs: standard
          .slice(0, 3)
          .map((item) => toImageRef(item.product.images[0]?.media, item.product.name)),
        variants: offeredVariants(row, row.items).map((offered) => offered.variant),
      };
    });
  }

  async detail(id: string): Promise<AdminProgram> {
    const row = await this.prisma.program.findUnique({ where: { id }, select: detailSelect });
    if (!row) throw notFound('Программа не найдена');
    const itemsOf = (variant: ProgramVariant): AdminProgramItem[] =>
      row.items
        .filter((item) => item.variant === variant)
        .map(({ product }) => ({
          id: product.id,
          name: product.name,
          shortName: product.shortName ?? product.name,
          brand: product.brand.name,
          volume: product.volume,
          priceKgs: product.priceKgs,
          image: toImageRef(product.images[0]?.media, product.name),
        }));
    const items = itemsOf('standard');
    // A variant stays in the editor while it has a price, even if deleting products emptied it.
    const variant = (key: ExtraProgramVariant, priceKgs: number | null) =>
      priceKgs === null ? null : { items: itemsOf(key), priceKgs };
    const step = (period: 'am' | 'pm') =>
      row.steps.filter((s) => s.period === period).map(({ productId, text }) => ({ productId, text }));
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      headline: row.headline,
      symptom: row.symptom,
      description: row.description,
      course: row.course,
      fit: row.fit,
      priceKgs: row.priceKgs,
      badge: row.badge as AdminProgram['badge'],
      quizGoal: row.quizGoal,
      quizSkins: row.quizSkins,
      published: row.published,
      inStock: row.inStock,
      items,
      variants: { mini: variant('mini', row.miniPriceKgs), max: variant('max', row.maxPriceKgs) },
      steps: { am: step('am'), pm: step('pm') },
      sumKgs: items.reduce((sum, item) => sum + item.priceKgs, 0),
      video: row.video ? toAdminVideo(row.video) : null,
      protocol: row.protocol ? toAdminMedia(row.protocol, this.env.MEDIA_PUBLIC_URL) : null,
      cover: row.cover ? toAdminMedia(row.cover, this.env.MEDIA_PUBLIC_URL) : null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(input: ProgramData, actor: Actor): Promise<AdminProgram> {
    const slug = await resolveSlug(input.slug, input.title, (candidate) => this.slugTaken(candidate));
    await this.check(input);
    const last = await this.prisma.program.aggregate({ _max: { order: true } });
    const row = await this.prisma.program.create({
      data: {
        ...this.fields(input),
        slug,
        order: (last._max.order ?? -1) + 1,
        items: { create: this.itemRows(input) },
        steps: { create: this.stepRows(input) },
      },
      select: { id: true },
    });
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'program',
      entityId: row.id,
      action: 'create',
      diff: { slug },
    });
    this.revalidator.revalidate(programTags(slug));
    this.revalidator.indexNow([`/programs/${slug}`, '/programs']);
    return this.detail(row.id);
  }

  async update(id: string, input: ProgramData, actor: Actor): Promise<AdminProgram> {
    const current = await this.prisma.program.findUnique({ where: { id }, select: { slug: true } });
    if (!current) throw notFound('Программа не найдена');
    const slug =
      input.slug && input.slug !== current.slug
        ? await resolveSlug(input.slug, input.title, (candidate) => this.slugTaken(candidate, id))
        : current.slug;
    await this.check(input);
    await this.prisma.$transaction([
      this.prisma.programItem.deleteMany({ where: { programId: id } }),
      this.prisma.programStep.deleteMany({ where: { programId: id } }),
      this.prisma.program.update({
        where: { id },
        data: {
          ...this.fields(input),
          slug,
          items: { create: this.itemRows(input) },
          steps: { create: this.stepRows(input) },
        },
      }),
    ]);
    await redirectSlug(this.prisma, '/programs', current.slug, slug);
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'program',
      entityId: id,
      action: 'update',
      ...(slug !== current.slug ? { diff: { slug: { from: current.slug, to: slug } } } : {}),
    });
    this.revalidator.revalidate([
      ...programTags(current.slug, slug),
      ...(slug !== current.slug ? [SITE_TAGS.redirects] : []),
    ]);
    this.revalidator.indexNow([`/programs/${current.slug}`, `/programs/${slug}`]);
    return this.detail(id);
  }

  async patch(id: string, change: { published?: boolean; inStock?: boolean }, actor: Actor) {
    const row = await this.prisma.program
      .update({ where: { id }, data: change, select: { slug: true } })
      .catch(() => null);
    if (!row) throw notFound('Программа не найдена');
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'program',
      entityId: id,
      action: 'update',
      diff: change,
    });
    this.revalidator.revalidate(programTags(row.slug));
    if (change.published !== undefined) this.revalidator.indexNow([`/programs/${row.slug}`, '/programs']);
    return this.detail(id);
  }

  /** Orders keep their item title; the program page starts redirecting to the list. */
  async remove(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.program.findUnique({ where: { id }, select: { slug: true } });
    if (!row) throw notFound('Программа не найдена');
    await this.prisma.program.delete({ where: { id } });
    await this.prisma.redirect.upsert({
      where: { fromPath: `/programs/${row.slug}` },
      create: { fromPath: `/programs/${row.slug}`, toPath: '/programs', statusCode: 302 },
      update: { toPath: '/programs', statusCode: 302 },
    });
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'program',
      entityId: id,
      action: 'delete',
      diff: { slug: row.slug },
    });
    this.revalidator.revalidate([...programTags(row.slug), SITE_TAGS.redirects]);
    this.revalidator.indexNow([`/programs/${row.slug}`, '/programs']);
  }

  private fields(input: ProgramData) {
    return {
      title: input.title,
      headline: input.headline,
      symptom: input.symptom,
      description: input.description,
      course: input.course,
      fit: input.fit.filter((line) => line.length > 0),
      priceKgs: input.priceKgs,
      miniPriceKgs: input.variants.mini?.priceKgs ?? null,
      maxPriceKgs: input.variants.max?.priceKgs ?? null,
      badge: input.badge,
      quizGoal: input.quizGoal,
      quizSkins: [...new Set(input.quizSkins)],
      published: input.published,
      inStock: input.inStock,
      videoId: input.videoId,
      protocolMediaId: input.protocolMediaId,
      coverMediaId: input.coverMediaId,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  /** «Стандарт»'s products, then those of «Мини» and «Максимум»; each list keeps its own order. */
  private itemRows(input: ProgramData) {
    const rows = (variant: ProgramVariant, ids: readonly string[]) =>
      ids.map((productId, order) => ({ productId, variant, order }));
    return [
      ...rows('standard', input.itemIds),
      ...EXTRA_PROGRAM_VARIANTS.flatMap((key) => rows(key, input.variants[key]?.itemIds ?? [])),
    ];
  }

  private stepRows(input: ProgramData) {
    return (['am', 'pm'] as const).flatMap((period) =>
      input.steps[period].map((step, order) => ({
        period,
        order,
        productId: step.productId,
        text: step.text,
      })),
    );
  }

  private async check(input: ProgramData): Promise<void> {
    const lists: [field: string, ids: string[]][] = [['itemIds', input.itemIds]];
    for (const key of EXTRA_PROGRAM_VARIANTS) {
      const variant = input.variants[key];
      if (variant) lists.push([`variants.${key}.itemIds`, variant.itemIds]);
    }
    for (const [field, ids] of lists) {
      if (new Set(ids).size !== ids.length) throw invalidField(field, 'program.items.duplicate');
    }
    const all = [...new Set(lists.flatMap(([, ids]) => ids))];
    const found = new Set(
      (await this.prisma.product.findMany({ where: { id: { in: all } }, select: { id: true } })).map(
        (product) => product.id,
      ),
    );
    for (const [field, ids] of lists) {
      if (ids.some((id) => !found.has(id))) throw invalidField(field, 'product.not_found');
    }
    const items = new Set(input.itemIds);
    for (const period of ['am', 'pm'] as const) {
      input.steps[period].forEach((step, index) => {
        if (!items.has(step.productId))
          throw invalidField(`steps.${period}.${index}.productId`, 'program.step.product');
      });
    }
    if (input.quizGoal) {
      const goal = await this.prisma.quizGoal.count({ where: { key: input.quizGoal } });
      if (!goal) throw invalidField('quizGoal', 'quiz.goal.not_found');
    }
    const skins = [...new Set(input.quizSkins)];
    if (skins.length) {
      const found = await this.prisma.skinType.count({ where: { key: { in: skins } } });
      if (found !== skins.length) throw invalidField('quizSkins', 'quiz.skin.not_found');
    }
    if (input.protocolMediaId) {
      const pdf = await this.prisma.media.count({ where: { id: input.protocolMediaId, kind: 'pdf' } });
      if (!pdf) throw invalidField('protocolMediaId', 'media.not_found');
    }
    if (input.coverMediaId) {
      const image = await this.prisma.media.count({ where: { id: input.coverMediaId, kind: 'image' } });
      if (!image) throw invalidField('coverMediaId', 'media.not_found');
    }
    if (input.videoId) {
      const video = await this.prisma.video.count({ where: { id: input.videoId } });
      if (!video) throw invalidField('videoId', 'video.not_found');
    }
  }

  private async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const row = await this.prisma.program.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(row && row.id !== exceptId);
  }
}
