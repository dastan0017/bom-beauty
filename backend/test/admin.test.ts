import { randomUUID } from 'node:crypto';
import type {
  Customer,
  Dashboard,
  ErrorResponse,
  LeadList,
  OrderCounters,
  OrderDetail,
  OrderList,
} from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderStatus } from '../src/generated/prisma/client';
import {
  createManager,
  createTestApp,
  loginAs,
  MANAGER,
  request,
  type AdminClient,
  type TestContext,
} from './app';

describe('admin: orders, leads, customers, overview', () => {
  let ctx: TestContext;
  let owner: AdminClient;
  let manager: AdminClient;
  let programId: string;

  async function addOrder(data: {
    name: string;
    phone: string;
    address?: string;
    title?: string;
    total?: number;
    status?: OrderStatus;
    minutesAgo?: number;
    program?: boolean;
  }) {
    const createdAt = new Date(Date.now() - (data.minutesAgo ?? 0) * 60_000);
    return ctx.prisma.order.create({
      data: {
        lines: {
          create: [
            {
              type: data.program ? 'program' : 'product',
              ...(data.program ? { programId } : {}),
              title: data.title ?? 'Cica-сыворотка',
              unitPriceKgs: data.total ?? 1900,
              qty: 1,
              totalKgs: data.total ?? 1900,
            },
          ],
        },
        totalKgs: data.total ?? 1900,
        name: data.name,
        phone: data.phone,
        address: data.address ?? 'Бишкек, ул. Токтогула, 1',
        message: 'Здравствуйте! Хочу заказать',
        clientRef: randomUUID(),
        status: data.status ?? 'new',
        createdAt,
        statusChangedAt: createdAt,
      },
    });
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await createManager(ctx);
    owner = await loginAs(ctx);
    manager = await loginAs(ctx, MANAGER);
    programId = (await ctx.prisma.program.findUniqueOrThrow({ where: { slug: 'acne' } })).id;

    // Oldest first, so UUIDv7 ids follow creation time like real orders.
    await addOrder({ name: 'Старый клиент', phone: '+996700000003', minutesAgo: 60 * 24 * 40, total: 9000 });
    await addOrder({ name: 'Айгерим', phone: '+996555123456', minutesAgo: 60 * 24 * 3, title: 'Пенка' });
    await addOrder({
      name: 'Айгерим К.',
      phone: '+996555123456',
      minutesAgo: 60 * 24 * 2,
      program: true,
      title: 'Акне',
      total: 5900,
    });
    await addOrder({
      name: 'Отмена',
      phone: '+996700000002',
      minutesAgo: 60,
      status: 'cancelled',
      total: 3000,
    });
    await addOrder({
      name: '=HYPERLINK("x")',
      phone: '+996700000001',
      address: 'Ош; центр',
      minutesAgo: 30,
      program: true,
      title: 'Акне',
      total: 5900,
    });
    await addOrder({
      name: 'Айгерим',
      phone: '+996555123456',
      minutesAgo: 5,
      program: true,
      title: 'Акне',
      total: 5900,
    });
  });
  afterAll(() => ctx.close());

  it('requires a session', async () => {
    const res = await request<ErrorResponse>(ctx.url('/v1/admin/orders'));
    expect(res.status).toBe(401);
  });

  it('lists orders newest first with city, filters and cursor pages', async () => {
    const page1 = await request<OrderList>(ctx.url('/v1/admin/orders?limit=4'), { headers: manager.read });
    expect(page1.status).toBe(200);
    expect(page1.body.items.map((o) => o.name)).toEqual([
      'Айгерим',
      '=HYPERLINK("x")',
      'Отмена',
      'Айгерим К.',
    ]);
    expect(page1.body.items[1]?.city).toBe('Ош; центр'.split(',')[0]);
    expect(page1.body.nextCursor).toBe(page1.body.items[3]?.id);
    const page2 = await request<OrderList>(
      ctx.url(`/v1/admin/orders?limit=4&cursor=${page1.body.nextCursor}`),
      {
        headers: manager.read,
      },
    );
    expect(page2.body.items.map((o) => o.name)).toEqual(['Айгерим', 'Старый клиент']);
    expect(page2.body.nextCursor).toBeNull();

    const cancelled = await request<OrderList>(ctx.url('/v1/admin/orders?status=cancelled'), {
      headers: manager.read,
    });
    expect(cancelled.body.items.map((o) => o.name)).toEqual(['Отмена']);
    const byPhone = await request<OrderList>(ctx.url('/v1/admin/orders?q=555%2012'), {
      headers: manager.read,
    });
    expect(byPhone.body.items).toHaveLength(3);
    const byNumber = await request<OrderList>(ctx.url('/v1/admin/orders?q=%231002'), {
      headers: manager.read,
    });
    expect(byNumber.body.items.map((o) => o.number)).toEqual([1002]);
  });

  it('changes the status with CSRF, keeps history and updates the counters', async () => {
    const [latest] = (
      await request<OrderList>(ctx.url('/v1/admin/orders?limit=1'), { headers: manager.read })
    ).body.items;
    if (!latest) throw new Error('no orders');
    const noCsrf = await request<ErrorResponse>(ctx.url(`/v1/admin/orders/${latest.id}`), {
      method: 'PATCH',
      headers: { ...manager.read, Origin: ctx.env.ADMIN_ORIGIN },
      json: { status: 'sent' },
    });
    expect(noCsrf.status).toBe(403);

    const before = (
      await request<OrderCounters>(ctx.url('/v1/admin/orders/counters'), { headers: manager.read })
    ).body;
    const res = await request<OrderDetail>(ctx.url(`/v1/admin/orders/${latest.id}`), {
      method: 'PATCH',
      headers: manager.write,
      json: { status: 'sent', note: 'Оплата получена' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'sent', note: 'Оплата получена' });
    expect(res.body.history.map((h) => [h.action, h.from, h.to, h.userName])).toEqual([
      ['status', 'new', 'sent', MANAGER.name],
      ['note', null, null, MANAGER.name],
    ]);
    const after = (
      await request<OrderCounters>(ctx.url('/v1/admin/orders/counters'), { headers: manager.read })
    ).body;
    expect(after).toEqual({ ...before, new: before.new - 1, sent: before.sent + 1 });

    const empty = await request<ErrorResponse>(ctx.url(`/v1/admin/orders/${latest.id}`), {
      method: 'PATCH',
      headers: manager.write,
      json: {},
    });
    expect(empty.status).toBe(400);
  });

  it('exports CSV for Excel, owner only', async () => {
    const forbidden = await request<ErrorResponse>(ctx.url('/v1/admin/orders/export.csv'), {
      headers: manager.read,
    });
    expect(forbidden.status).toBe(403);

    const res = await fetch(ctx.url('/v1/admin/orders/export.csv?status=new'), { headers: owner.read });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/csv/);
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="bom-orders-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const buffer = new Uint8Array(await res.arrayBuffer());
    expect([...buffer.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder().decode(buffer.slice(3)).trimEnd().split('\r\n');
    expect(lines[0]).toMatch(/^Номер;Дата;Статус;Клиент;Телефон;Город;Адрес;/);
    expect(lines).toHaveLength(5); // header + the four orders still "new" after the status test
    const formula = lines.find((line) => line.includes('HYPERLINK'));
    expect(formula).toContain(`"'=HYPERLINK(""x"")"`);
    expect(formula).toContain('"Ош; центр"');
    expect(lines[1]).toMatch(/;\d{2}\.\d{2}\.\d{4} \d{2}:\d{2};Новый;/);
  });

  it('deletes an order, owner only', async () => {
    const victim = await addOrder({ name: 'Удалить меня', phone: '+996700000009', minutesAgo: 1 });
    const asManager = await request(ctx.url(`/v1/admin/orders/${victim.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(asManager.status).toBe(403);
    const asOwner = await request(ctx.url(`/v1/admin/orders/${victim.id}`), {
      method: 'DELETE',
      headers: owner.write,
    });
    expect(asOwner.status).toBe(204);
    expect(await ctx.prisma.order.findUnique({ where: { id: victim.id } })).toBeNull();
    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entityId: victim.id, action: 'delete' },
    });
    expect(JSON.stringify(log.diff)).not.toContain('Удалить меня');
  });

  it('aggregates customers by phone without cancelled orders', async () => {
    const res = await request<Customer[]>(ctx.url('/v1/admin/customers'), { headers: manager.read });
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      name: 'Айгерим',
      phone: '+996555123456',
      city: 'Бишкек',
      count: 3,
      totalKgs: 1900 + 5900 + 5900,
      favorite: 'Акне',
    });
    expect(res.body.map((c) => c.name)).not.toContain('Отмена');
    const search = await request<Customer[]>(ctx.url('/v1/admin/customers?q=0000003'), {
      headers: manager.read,
    });
    expect(search.body.map((c) => c.name)).toEqual(['Старый клиент']);
  });

  it('summarises the period on the overview', async () => {
    const week = await request<Dashboard>(ctx.url('/v1/admin/dashboard?period=week'), {
      headers: manager.read,
    });
    expect(week.status).toBe(200);
    expect(week.body.cards).toMatchObject({ orders: 5, cancelled: 1, cancelledWeek: 1, previousOrders: 0 });
    expect(week.body.cards.sumKgs).toBe(1900 + 5900 + 5900 + 5900);
    expect(week.body.cards.avgKgs).toBe(Math.round((1900 + 5900 * 3) / 4));
    expect(week.body.recent).toHaveLength(6);
    const program = await ctx.prisma.program.findUniqueOrThrow({ where: { id: programId } });
    expect(week.body.byProgram).toEqual([{ title: program.title, count: 3 }]);
    expect(week.body.programOrdersTotal).toBe(3);
    const month = await request<Dashboard>(ctx.url('/v1/admin/dashboard?period=month'), {
      headers: manager.read,
    });
    expect(month.body.cards.previousOrders).toBe(1);
  });

  it('lists leads with recommended program titles', async () => {
    await ctx.prisma.lead.create({
      data: {
        kind: 'quiz',
        answers: { skin: 'oily', goal: 'acne', exp: 'new', fmt: 'set' },
        recommended: ['acne', 'gone-program'],
        message: 'Здравствуйте',
        clientRef: randomUUID(),
      },
    });
    await ctx.prisma.lead.create({
      data: {
        kind: 'wholesale',
        answers: { buyer: 'salon' },
        recommended: [],
        message: 'Опт',
        clientRef: randomUUID(),
      },
    });
    const res = await request<LeadList>(ctx.url('/v1/admin/leads?kind=quiz'), { headers: manager.read });
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ all: 2, quiz: 1, wholesale: 1 });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]?.answers).toEqual({ skin: 'oily', goal: 'acne', exp: 'new', fmt: 'set' });
    expect(res.body.items[0]?.recommended[1]).toEqual({ slug: 'gone-program', title: 'gone-program' });
    expect(res.body.items[0]?.recommended[0]?.slug).toBe('acne');
  });

  it('deletes a lead, owner only', async () => {
    const lead = await ctx.prisma.lead.create({
      data: { kind: 'wholesale', answers: {}, recommended: [], message: 'Тест', clientRef: randomUUID() },
    });
    const forbidden = await request(ctx.url(`/v1/admin/leads/${lead.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(forbidden.status).toBe(403);
    const removed = await request(ctx.url(`/v1/admin/leads/${lead.id}`), {
      method: 'DELETE',
      headers: owner.write,
    });
    expect(removed.status).toBe(204);
    expect(await ctx.prisma.lead.count({ where: { id: lead.id } })).toBe(0);
    const again = await request(ctx.url(`/v1/admin/leads/${lead.id}`), {
      method: 'DELETE',
      headers: owner.write,
    });
    expect(again.status).toBe(404);
  });

  it('shows every line of a cart order and finds it by any of its products', async () => {
    const cart = await ctx.prisma.order.create({
      data: {
        lines: {
          create: [
            {
              position: 0,
              type: 'product',
              title: 'Cica-сыворотка',
              unitPriceKgs: 1900,
              qty: 2,
              totalKgs: 3800,
            },
            {
              position: 1,
              type: 'product',
              title: 'Флюид SPF 50+',
              unitPriceKgs: 1300,
              qty: 1,
              totalKgs: 1300,
            },
          ],
        },
        totalKgs: 5100,
        name: 'Корзина',
        phone: '+996700000010',
        address: 'Бишкек',
        message: 'Здравствуйте! Хочу заказать',
        clientRef: randomUUID(),
      },
    });
    const detail = await request<OrderDetail>(ctx.url(`/v1/admin/orders/${cart.id}`), {
      headers: manager.read,
    });
    expect(detail.body.lines.map((line) => [line.title, line.qty, line.totalKgs])).toEqual([
      ['Cica-сыворотка', 2, 3800],
      ['Флюид SPF 50+', 1, 1300],
    ]);
    const found = await request<OrderList>(ctx.url(`/v1/admin/orders?q=${encodeURIComponent('флюид')}`), {
      headers: manager.read,
    });
    expect(found.body.items.map((o) => o.name)).toContain('Корзина');
    const csv = await (
      await fetch(ctx.url('/v1/admin/orders/export.csv?q=%D0%9A%D0%BE%D1%80%D0%B7'), {
        headers: owner.read,
      })
    ).text();
    expect(csv).toContain(';Корзина · 3 товара;Cica-сыворотка × 2, Флюид SPF 50+;3;;5100;');
  });
});
