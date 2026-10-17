import { randomUUID } from 'node:crypto';
import type { CreateOrderInput, ErrorResponse } from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, request, type TestContext } from './app';

const order = (overrides: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  clientRef: randomUUID(),
  item: { type: 'product', slug: 'dr-sgn-cica-serum' },
  qty: 2,
  name: 'Айгерим',
  phone: '0555 12 34 56',
  address: 'Бишкек, ул. Токтогула 1',
  message: 'Здравствуйте! Хочу заказать…',
  pageUrl: 'http://localhost:3100/catalog/dr-sgn-cica-serum',
  ...overrides,
});

describe('POST /v1/orders', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('stores a product order with server prices and an E.164 phone', async () => {
    const res = await request<{ id: string; number: number }>(ctx.url('/v1/orders'), {
      method: 'POST',
      json: order({ priceKgs: 1 } as Partial<CreateOrderInput>),
    });
    expect(res.status).toBe(201);
    expect(res.body.number).toBe(1001);
    const row = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({
      itemType: 'product',
      itemTitle: 'Успокаивающая cica-сыворотка',
      unitPriceKgs: 1900,
      qty: 2,
      totalKgs: 3800,
      phone: '+996555123456',
      status: 'new',
      displayCurrency: 'KGS',
      displayRate: null,
    });
    expect(row.ipHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('stores a program order and the display currency', async () => {
    const res = await request<{ id: string }>(ctx.url('/v1/orders'), {
      method: 'POST',
      json: order({
        item: { type: 'program', slug: 'acne' },
        qty: 1,
        displayCurrency: 'USD',
        displayRate: 87.4,
        fromQuiz: true,
      }),
    });
    expect(res.status).toBe(201);
    const row = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({
      itemType: 'program',
      totalKgs: 5900,
      displayCurrency: 'USD',
      displayRate: 87.4,
      fromQuiz: true,
    });
  });

  it('is idempotent per clientRef', async () => {
    const body = order();
    const first = await request<{ id: string }>(ctx.url('/v1/orders'), { method: 'POST', json: body });
    const second = await request<{ id: string }>(ctx.url('/v1/orders'), { method: 'POST', json: body });
    expect(second.body).toEqual(first.body);
    expect(await ctx.prisma.order.count({ where: { clientRef: body.clientRef } })).toBe(1);
  });

  it('pretends success for bots and stores nothing', async () => {
    const body = order({ website: 'http://spam.example' });
    const res = await request<{ number: number }>(ctx.url('/v1/orders'), { method: 'POST', json: body });
    expect(res.status).toBe(201);
    expect(res.body.number).toBe(0);
    expect(await ctx.prisma.order.count({ where: { clientRef: body.clientRef } })).toBe(0);
  });

  it('returns the design validation codes', async () => {
    const res = await request<ErrorResponse>(ctx.url('/v1/orders'), {
      method: 'POST',
      json: order({ name: 'А', phone: '12', address: 'Б', qty: 10 }),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.fields).toMatchObject({
      name: 'order.name.required',
      phone: 'order.phone.required',
      address: 'order.address.required',
    });
    expect(res.body.error.fields?.qty).toBeDefined();
  });

  it('rejects numbers that cannot exist', async () => {
    const res = await request<ErrorResponse>(ctx.url('/v1/orders'), {
      method: 'POST',
      json: order({ phone: '+996 000 000 000' }),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields?.phone).toBe('phone.invalid');
  });

  it('refuses unpublished items', async () => {
    await ctx.prisma.product.update({ where: { slug: 'dr-sgn-cica-serum' }, data: { published: false } });
    const res = await request<ErrorResponse>(ctx.url('/v1/orders'), { method: 'POST', json: order() });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    await ctx.prisma.product.update({ where: { slug: 'dr-sgn-cica-serum' }, data: { published: true } });
  });
});
