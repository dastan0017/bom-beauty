import type {
  ContentResponse,
  ProductCard,
  ProgramCard,
  ProgramDetail,
  PublicSettings,
  ReviewCard,
} from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, request, type TestContext } from './app';

describe('public catalog', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('lists categories with published product counts', async () => {
    const res = await request(ctx.url('/v1/catalog/categories'));
    expect(res.body).toEqual([
      { slug: 'cleansing', name: 'Очищение', count: 2 },
      { slug: 'toners', name: 'Тонеры', count: 3 },
      { slug: 'serums', name: 'Сыворотки', count: 5 },
      { slug: 'creams', name: 'Кремы', count: 2 },
      { slug: 'spf', name: 'SPF', count: 1 },
    ]);
  });

  it('hides unpublished products from lists and detail pages', async () => {
    await ctx.prisma.product.update({
      where: { slug: 'ronas-stem-cell-z-serum' },
      data: { published: false },
    });
    const list = await request<ProductCard[]>(ctx.url('/v1/catalog/products?category=serums'));
    expect(list.body.map((p) => p.slug)).not.toContain('ronas-stem-cell-z-serum');
    expect((await request(ctx.url('/v1/catalog/products/ronas-stem-cell-z-serum'))).status).toBe(404);
    await ctx.prisma.product.update({
      where: { slug: 'ronas-stem-cell-z-serum' },
      data: { published: true },
    });
  });

  it('returns a program with items, savings base and routine steps in order', async () => {
    const res = await request<ProgramDetail>(ctx.url('/v1/catalog/programs/acne'));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.shortName)).toEqual([
      'Пенка для умывания',
      'Тонер с BHA',
      'Cica-сыворотка',
      'Крем-гель',
      'Флюид SPF 50+',
    ]);
    expect(res.body.sumKgs).toBe(7400);
    expect(res.body.priceKgs).toBe(5900);
    expect(res.body.steps.pm.map((s) => s.text)).toEqual([
      'Смывает SPF и себум за день',
      'Помогает очистить поры',
      'Увлажняет без жирной плёнки',
    ]);
    expect(res.body.protocol).toBeNull();
    expect(res.body.video).toBeNull();
  });

  it('lists programs in order with quiz matching data', async () => {
    const res = await request<ProgramCard[]>(ctx.url('/v1/catalog/programs'));
    expect(res.body.map((p) => p.slug)).toEqual([
      'acne',
      'dry-skin',
      'pigmentation',
      'sensitive-skin',
      'lifting',
    ]);
    expect(res.body[0]?.quiz).toEqual({ goal: 'acne', skins: ['oily', 'normal'] });
  });

  it('serves public settings with only enabled currencies', async () => {
    await ctx.prisma.setting.update({
      where: { key: 'currencies' },
      data: { value: { KRW: { enabled: false, rate: 16 } } },
    });
    const res = await request<PublicSettings>(ctx.url('/v1/settings/public'));
    expect(res.body.currencies.map((c) => c.code)).toEqual(['KGS', 'USD', 'RUB', 'EUR', 'KZT', 'UZS']);
    expect(res.body.shop.whatsapp).toBe('+996706304803');
    expect(res.body.analytics.metaPixelId).toBeNull();
  });

  it('resolves featured products of the wholesale page in the owner order', async () => {
    const res = await request<ContentResponse>(ctx.url('/v1/content/wholesale'));
    expect(res.body.refs.products.map((p) => p.slug).slice(0, 2)).toEqual([
      'dr-sgn-pdrn-perfect-ampoule',
      'ronas-stem-cell-z-serum',
    ]);
  });

  it('shows demo reviews only until a real one is visible', async () => {
    const media = (n: number) =>
      ctx.prisma.media.create({
        data: {
          bucket: 'public',
          kind: 'image',
          status: 'ready',
          width: 720,
          height: 1280,
          variants: { widths: [320, 640] },
          key: `p/${n}`,
        },
      });
    const demo = await media(1);
    await ctx.prisma.review.create({ data: { mediaId: demo.id, isDemo: true } });
    expect((await request<ReviewCard[]>(ctx.url('/v1/reviews'))).body).toHaveLength(1);

    const real = await media(2);
    await ctx.prisma.review.create({ data: { mediaId: real.id, order: 1 } });
    const reviews = (await request<ReviewCard[]>(ctx.url('/v1/reviews'))).body;
    expect(reviews.map((r) => r.image.id)).toEqual([real.id]);
  });

  it('uses the shared error format for unknown routes and bad params', async () => {
    const res = await request<{ error: { code: string } }>(
      ctx.url('/v1/catalog/products?category=BAD%20SLUG'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});
