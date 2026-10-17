import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  AdminCategory,
  AdminContent,
  AdminProduct,
  AdminProductRow,
  AdminProgram,
  AdminReview,
  AdminUser,
  ErrorResponse,
  ProductInput,
  ProgramInput,
  RedirectTarget,
} from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createManager,
  createTestApp,
  loginAs,
  MANAGER,
  OWNER,
  request,
  type AdminClient,
  type TestContext,
} from './app';

/** Stand-in for the web server: records POST /api/revalidate calls. */
async function fakeWeb(): Promise<{
  server: Server;
  url: string;
  calls: { secret: string; tags: string[] }[];
}> {
  const calls: { secret: string; tags: string[] }[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}') as { tags?: string[] };
      calls.push({ secret: String(req.headers['x-revalidate-secret'] ?? ''), tags: parsed.tags ?? [] });
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}

const waitFor = async (check: () => boolean, ms = 2_000): Promise<void> => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe('admin: catalog, content, settings, users', () => {
  let ctx: TestContext;
  let web: Awaited<ReturnType<typeof fakeWeb>>;
  let owner: AdminClient;
  let manager: AdminClient;
  let categoryId: string;
  const api = (path: string) => ctx.url(`/v1/admin${path}`);

  const product = (overrides: Partial<ProductInput> = {}): ProductInput => ({
    name: 'Тестовый тонер',
    slug: '',
    brandName: 'Новый Бренд',
    categoryId,
    volume: '150 мл',
    priceKgs: 1500,
    purpose: 'Увлажняет',
    description: 'Описание',
    howToUse: 'Нанести',
    inci: null,
    badge: null,
    inStock: true,
    published: true,
    imageIds: [],
    shortName: null,
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  });

  beforeAll(async () => {
    web = await fakeWeb();
    ctx = await createTestApp({ WEB_INTERNAL_URL: web.url });
    await createManager(ctx);
    owner = await loginAs(ctx);
    manager = await loginAs(ctx, MANAGER);
    categoryId = (await ctx.prisma.category.findUniqueOrThrow({ where: { slug: 'toners' } })).id;
  });
  afterAll(async () => {
    await ctx.close();
    await new Promise((resolve) => web.server.close(resolve));
  });

  it('manages categories: unique names, only empty ones can be deleted', async () => {
    const created = await request<AdminCategory>(api('/categories'), {
      method: 'POST',
      headers: manager.write,
      json: { name: 'Маски' },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Маски', slug: 'maski', count: 0 });
    const duplicate = await request<ErrorResponse>(api('/categories'), {
      method: 'POST',
      headers: manager.write,
      json: { name: 'маски' },
    });
    expect(duplicate.status).toBe(409);
    const busy = await request<ErrorResponse>(api(`/categories/${categoryId}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(busy.body.error.fields).toEqual({ id: 'category.not_empty' });
    const removed = await request(api(`/categories/${created.body.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(removed.status).toBe(204);
  });

  it('creates and edits a product, makes the brand, redirects the old slug and revalidates the site', async () => {
    const created = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product(),
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: 'testovyy-toner', brandName: 'Новый Бренд', priceKgs: 1500 });
    expect(await ctx.prisma.brand.count({ where: { name: 'Новый Бренд' } })).toBe(1);
    await waitFor(() => web.calls.some((call) => call.tags.includes('product:testovyy-toner')));
    expect(web.calls.find((call) => call.tags.includes('product:testovyy-toner'))).toEqual({
      secret: ctx.env.REVALIDATE_SECRET,
      tags: expect.arrayContaining([
        'products',
        'programs',
        'product:testovyy-toner',
        'categories',
      ]) as string[],
    });

    const renamed = await request<AdminProduct>(api(`/products/${created.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: product({ name: 'Тонер плюс', slug: 'toner-plus', brandName: 'новый бренд', priceKgs: 1700 }),
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ slug: 'toner-plus', priceKgs: 1700, brandName: 'Новый Бренд' });
    const redirect = await request<RedirectTarget>(
      ctx.url('/v1/redirects/resolve?path=%2Fcatalog%2Ftestovyy-toner'),
    );
    expect(redirect.body).toEqual({ toPath: '/catalog/toner-plus', statusCode: 308 });

    const taken = await request<ErrorResponse>(api(`/products/${created.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: product({ slug: 'dr-sgn-cica-serum' }),
    });
    expect(taken.status).toBe(409);
    expect(taken.body.error.fields).toEqual({ slug: 'slug.taken' });

    const off = await request<AdminProduct>(api(`/products/${created.body.id}`), {
      method: 'PATCH',
      headers: manager.write,
      json: { inStock: false },
    });
    expect(off.body.inStock).toBe(false);

    const list = await request<AdminProductRow[]>(api(`/products?q=${encodeURIComponent('тонер плюс')}`), {
      headers: manager.read,
    });
    expect(list.body.map((row) => row.slug)).toEqual(['toner-plus']);

    const invalid = await request<ErrorResponse>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: '', priceKgs: 0 }),
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.fields).toMatchObject({
      name: 'product.name.required',
      priceKgs: 'price.required',
    });
  });

  it('refuses to delete a product that is part of a program', async () => {
    const cica = await ctx.prisma.product.findUniqueOrThrow({ where: { slug: 'dr-sgn-cica-serum' } });
    const res = await request<ErrorResponse>(api(`/products/${cica.id}`), {
      method: 'DELETE',
      headers: owner.write,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.fields).toEqual({ id: 'product.in_program' });
  });

  it('saves programs with ordered items, steps limited to those items, savings and slug redirects', async () => {
    const [a, b, c] = await ctx.prisma.product.findMany({ take: 3, orderBy: { priceKgs: 'asc' } });
    if (!a || !b || !c) throw new Error('seed products missing');
    const input: ProgramInput = {
      title: 'Тестовая программа',
      slug: '',
      headline: 'тестовой коже',
      symptom: 'Сухость',
      description: '',
      course: 'Утро и вечер, курс 4 недели',
      fit: ['Кожа стягивает', ''],
      priceKgs: a.priceKgs + b.priceKgs - 100,
      badge: 'Новинка',
      quizGoal: 'barrier',
      quizSkins: ['dry', 'dry'],
      published: false,
      inStock: true,
      itemIds: [b.id, a.id],
      steps: { am: [{ productId: a.id, text: 'Нанести утром' }], pm: [] },
      videoId: null,
      protocolMediaId: null,
      seoTitle: null,
      seoDescription: null,
    };
    const created = await request<AdminProgram>(api('/programs'), {
      method: 'POST',
      headers: manager.write,
      json: input,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      slug: 'testovaya-programma',
      fit: ['Кожа стягивает'],
      quizSkins: ['dry'],
      sumKgs: a.priceKgs + b.priceKgs,
      steps: { am: [{ productId: a.id, text: 'Нанести утром' }], pm: [] },
    });
    expect(created.body.items.map((item) => item.id)).toEqual([b.id, a.id]);

    const badStep = await request<ErrorResponse>(api(`/programs/${created.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: { ...input, steps: { am: [], pm: [{ productId: c.id, text: 'Не из программы' }] } },
    });
    expect(badStep.status).toBe(400);
    expect(badStep.body.error.fields).toEqual({ 'steps.pm.0.productId': 'program.step.product' });

    await request(api(`/programs/${created.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: { ...input, slug: 'novaya-programma' },
    });
    const redirect = await request<RedirectTarget>(
      ctx.url('/v1/redirects/resolve?path=%2Fprograms%2Ftestovaya-programma'),
    );
    expect(redirect.body.toPath).toBe('/programs/novaya-programma');

    // Unpublished programs stay off the site until switched on.
    expect((await request(ctx.url('/v1/catalog/programs/novaya-programma'))).status).toBe(404);
    await request(api(`/programs/${created.body.id}`), {
      method: 'PATCH',
      headers: manager.write,
      json: { published: true },
    });
    expect((await request(ctx.url('/v1/catalog/programs/novaya-programma'))).status).toBe(200);

    const removed = await request(api(`/programs/${created.body.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(removed.status).toBe(204);
    const gone = await request<RedirectTarget>(
      ctx.url('/v1/redirects/resolve?path=%2Fprograms%2Fnovaya-programma'),
    );
    expect(gone.body).toEqual({ toPath: '/programs', statusCode: 302 });
  });

  it('orders, hides and deletes reviews; real ones hide the demo examples', async () => {
    const image = (n: number) =>
      ctx.prisma.media.create({
        data: {
          bucket: 'public',
          kind: 'image',
          status: 'ready',
          width: 600,
          height: 1200,
          variants: { widths: [320] },
          key: `r${n}`,
        },
      });
    const demoMedia = await image(0);
    await ctx.prisma.review.create({ data: { mediaId: demoMedia.id, isDemo: true } });
    const [m1, m2] = [await image(1), await image(2)];
    const created = await request<AdminReview[]>(api('/reviews'), {
      method: 'POST',
      headers: manager.write,
      json: { mediaIds: [m1.id, m2.id] },
    });
    expect(created.status).toBe(201);
    expect(created.body.map((r) => [r.isDemo, r.isHidden])).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ]);
    const ids = created.body.map((r) => r.id);
    const reordered = await request<AdminReview[]>(api('/reviews/order'), {
      method: 'PUT',
      headers: manager.write,
      json: { ids: [ids[2], ids[1]] },
    });
    expect(reordered.body.map((r) => r.id)).toEqual([ids[2], ids[1], ids[0]]);
    const publicReviews = await request<{ id: string }[]>(ctx.url('/v1/reviews'));
    expect(publicReviews.body.map((r) => r.id)).toEqual([ids[2], ids[1]]);
  });

  it('validates content blocks and serves the saved version on the site', async () => {
    const current = await request<AdminContent>(api('/content/delivery'), { headers: manager.read });
    expect(current.status).toBe(200);
    const bad = await request<ErrorResponse>(api('/content/delivery'), {
      method: 'PUT',
      headers: manager.write,
      json: { data: { ...current.body.data, faq: [{ q: 'Вопрос' }] } },
    });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.fields ?? {})).toEqual(['data.faq.0.a']);
    const saved = await request<AdminContent>(api('/content/delivery'), {
      method: 'PUT',
      headers: manager.write,
      json: { data: { ...current.body.data, faq: [{ q: 'Когда доставка?', a: 'В день оплаты' }] } },
    });
    expect(saved.status).toBe(200);
    const site = await request<{ data: { faq: unknown[] } }>(ctx.url('/v1/content/delivery'));
    expect(site.body.data.faq).toEqual([{ q: 'Когда доставка?', a: 'В день оплаты' }]);
  });

  it('lets managers change appearance but not SEO; the theme reaches the public settings', async () => {
    const appearance = await request(api('/settings/appearance'), {
      method: 'PUT',
      headers: manager.write,
      json: { value: { theme: 'sky', headerColor: '#ffffff', accentColor: '#2f6bb0' } },
    });
    expect(appearance.status).toBe(200);
    const settings = await request<{ appearance: { theme: string } }>(ctx.url('/v1/settings/public'));
    expect(settings.body.appearance.theme).toBe('sky');
    const seo = await request<ErrorResponse>(api('/settings/seo'), {
      method: 'PUT',
      headers: manager.write,
      json: {
        value: {
          defaultTitle: 'x',
          defaultDescription: 'y',
          ogMediaId: null,
          googleVerification: null,
          yandexVerification: null,
        },
      },
    });
    expect(seo.status).toBe(403);
    const invalid = await request<ErrorResponse>(api('/settings/appearance'), {
      method: 'PUT',
      headers: owner.write,
      json: { value: { theme: 'sky', headerColor: 'blue', accentColor: '#2f6bb0' } },
    });
    expect(invalid.body.error.fields).toEqual({ 'value.headerColor': 'colour.invalid' });
    const visible = await request<Record<string, unknown>>(api('/settings'), { headers: manager.read });
    expect(Object.keys(visible.body).sort()).toEqual(['appearance', 'currencies', 'shop']);
  });

  it('manages users: owner only, never removes the last owner, a new password signs the user out', async () => {
    expect((await request(api('/users'), { headers: manager.read })).status).toBe(403);
    const users = await request<AdminUser[]>(api('/users'), { headers: owner.read });
    const me = users.body.find((u) => u.email === OWNER.email);
    const theManager = users.body.find((u) => u.email === MANAGER.email);
    if (!me || !theManager) throw new Error('users missing');
    const demoteSelf = await request<ErrorResponse>(api(`/users/${me.id}`), {
      method: 'PUT',
      headers: owner.write,
      json: { role: 'manager' },
    });
    expect(demoteSelf.status).toBe(409);
    const password = await request(api(`/users/${theManager.id}/password`), {
      method: 'POST',
      headers: owner.write,
      json: { password: 'another-long-password' },
    });
    expect(password.status).toBe(204);
    expect((await request(api('/orders/counters'), { headers: manager.read })).status).toBe(401);
    const audit = await request<{ items: { action: string; entity: string }[] }>(api('/audit?entity=user'), {
      headers: owner.read,
    });
    expect(audit.body.items[0]).toMatchObject({ entity: 'user', action: 'password' });
  });
});
