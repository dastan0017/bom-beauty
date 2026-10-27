import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  AdminBrand,
  AdminCategory,
  AdminContent,
  AdminProduct,
  AdminProductRow,
  AdminProgram,
  AdminReview,
  AdminUser,
  ErrorResponse,
  ProductCard,
  ProductDetail,
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
    brandDescription: null,
    videoId: null,
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
    bestseller: false,
    seoulChoice: false,
    isNew: false,
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

  it('deletes a product that is part of a program and featured on the wholesale page', async () => {
    const created = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: 'Тонер на удаление' }),
    });
    const id = created.body.id;
    const other = await ctx.prisma.product.findUniqueOrThrow({ where: { slug: 'dr-sgn-cica-serum' } });
    const program = await ctx.prisma.program.findFirstOrThrow({
      where: { items: { some: { productId: other.id } } },
      select: { id: true, slug: true, priceKgs: true, items: { select: { productId: true } } },
    });
    await ctx.prisma.programItem.create({ data: { programId: program.id, productId: id, order: 99 } });
    await ctx.prisma.programStep.create({
      data: { programId: program.id, productId: id, period: 'am', order: 99, text: 'Шаг' },
    });
    const wholesale = await request<AdminContent>(api('/content/wholesale'), { headers: manager.read });
    const featured = wholesale.body.data.featuredProductIds as string[];
    const saved = await request(api('/content/wholesale'), {
      method: 'PUT',
      headers: manager.write,
      json: { data: { ...wholesale.body.data, featuredProductIds: [id, ...featured] } },
    });
    expect(saved.status).toBe(200);

    const res = await request(api(`/products/${id}`), { method: 'DELETE', headers: owner.write });
    expect(res.status).toBe(204);
    expect(await ctx.prisma.product.count({ where: { id } })).toBe(0);
    const after = await ctx.prisma.program.findUniqueOrThrow({
      where: { id: program.id },
      select: {
        priceKgs: true,
        items: { select: { productId: true } },
        steps: { select: { productId: true } },
      },
    });
    expect(after.priceKgs).toBe(program.priceKgs);
    expect(after.items.map((item) => item.productId).sort()).toEqual(
      program.items.map((item) => item.productId).sort(),
    );
    expect(after.steps.some((step) => step.productId === id)).toBe(false);
    await waitFor(() => web.calls.some((call) => call.tags.includes(`program:${program.slug}`)));

    // The wholesale page still saves: the deleted product left its featured list.
    const reread = await request<AdminContent>(api('/content/wholesale'), { headers: manager.read });
    expect(reread.body.data.featuredProductIds).toEqual(featured);
    const resaved = await request(api('/content/wholesale'), {
      method: 'PUT',
      headers: manager.write,
      json: { data: reread.body.data },
    });
    expect(resaved.status).toBe(200);
  });

  it('applies bulk actions to the ticked products', async () => {
    const make = async (name: string) =>
      (
        await request<AdminProduct>(api('/products'), {
          method: 'POST',
          headers: manager.write,
          json: product({ name }),
        })
      ).body;
    const [a, b] = [await make('Пакет один'), await make('Пакет два')];
    const ids = [a.id, b.id];
    const bulk = (json: Record<string, unknown>) =>
      request<{ count: number }>(api('/products/bulk'), { method: 'POST', headers: manager.write, json });
    const state = async () =>
      ctx.prisma.product.findMany({
        where: { id: { in: ids } },
        select: { published: true, inStock: true, categoryId: true },
      });

    expect((await bulk({ ids, action: 'hide' })).body).toEqual({ count: 2 });
    expect((await state()).every((row) => !row.published)).toBe(true);
    await bulk({ ids, action: 'show' });
    await bulk({ ids, action: 'outOfStock' });
    expect((await state()).every((row) => row.published && !row.inStock)).toBe(true);

    const noTarget = await request<ErrorResponse>(api('/products/bulk'), {
      method: 'POST',
      headers: manager.write,
      json: { ids, action: 'category' },
    });
    expect(noTarget.status).toBe(400);
    const serums = await ctx.prisma.category.findUniqueOrThrow({ where: { slug: 'serums' } });
    await bulk({ ids, action: 'category', categoryId: serums.id });
    expect((await state()).every((row) => row.categoryId === serums.id)).toBe(true);

    // Deleting also takes them out of programs; an unknown id is skipped.
    const program = await ctx.prisma.program.findFirstOrThrow({ select: { id: true } });
    await ctx.prisma.programItem.create({ data: { programId: program.id, productId: a.id, order: 98 } });
    const deleted = await bulk({ ids: [...ids, randomUUID()], action: 'delete' });
    expect(deleted.body).toEqual({ count: 2 });
    expect(await ctx.prisma.product.count({ where: { id: { in: ids } } })).toBe(0);
    expect(await ctx.prisma.programItem.count({ where: { productId: a.id } })).toBe(0);
  });

  it('keeps brand and category names unique, and renames, merges and deletes them', async () => {
    // Categories: a name that differs only in case, spaces or punctuation is taken.
    const taken = await request<ErrorResponse>(api('/categories'), {
      method: 'POST',
      headers: manager.write,
      json: { name: ' тонеры. ' },
    });
    expect(taken.status).toBe(409);
    expect(taken.body.error.fields).toEqual({ name: 'category.name.taken' });
    const extra = await request<AdminCategory>(api('/categories'), {
      method: 'POST',
      headers: manager.write,
      json: { name: 'Тонеры для лица' },
    });
    const moved = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: 'Тонер в дубле', categoryId: extra.body.id }),
    });
    const renameTaken = await request<ErrorResponse>(api(`/categories/${extra.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: { name: 'ТОНЕРЫ' },
    });
    expect(renameTaken.body.error.fields).toEqual({ name: 'category.name.taken' });
    const busy = await request<ErrorResponse>(api(`/categories/${extra.body.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(busy.status).toBe(409);
    const merged = await request<AdminCategory>(api(`/categories/${extra.body.id}/merge`), {
      method: 'POST',
      headers: manager.write,
      json: { intoId: categoryId },
    });
    expect(merged.status).toBe(200);
    expect(merged.body.id).toBe(categoryId);
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: moved.body.id } })).categoryId).toBe(
      categoryId,
    );
    expect(await ctx.prisma.category.count({ where: { id: extra.body.id } })).toBe(0);

    // Brands: «dr sgn» joins the existing «Dr. SGN» instead of making a new one.
    const joined = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: 'Тонер dr sgn', brandName: 'dr sgn' }),
    });
    expect(joined.body.brandName).toBe('Dr. SGN');
    // A duplicate saved before names were compared this way merges into the right one and keeps its «О бренде».
    const original = await ctx.prisma.brand.findUniqueOrThrow({ where: { slug: 'dr-sgn' } });
    const dupe = await ctx.prisma.brand.create({
      data: { name: 'Dr.SGN', slug: 'dr-sgn-dupe', description: 'Текст дубля' },
    });
    await ctx.prisma.product.update({ where: { id: joined.body.id }, data: { brandId: dupe.id } });
    const notEmpty = await request<ErrorResponse>(api(`/brands/${dupe.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(notEmpty.body.error.fields).toEqual({ id: 'brand.not_empty' });
    const brandTaken = await request<ErrorResponse>(api(`/brands/${dupe.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: { name: 'DR SGN' },
    });
    expect(brandTaken.body.error.fields).toEqual({ name: 'brand.name.taken' });
    const same = await request<ErrorResponse>(api(`/brands/${dupe.id}/merge`), {
      method: 'POST',
      headers: manager.write,
      json: { intoId: dupe.id },
    });
    expect(same.body.error.fields).toEqual({ intoId: 'merge.same' });
    const mergedBrand = await request<AdminBrand>(api(`/brands/${dupe.id}/merge`), {
      method: 'POST',
      headers: manager.write,
      json: { intoId: original.id },
    });
    expect(mergedBrand.body).toMatchObject({ id: original.id, name: 'Dr. SGN', description: 'Текст дубля' });
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: joined.body.id } })).brandId).toBe(
      original.id,
    );
    expect(await ctx.prisma.brand.count({ where: { id: dupe.id } })).toBe(0);

    // The list carries product counts; an empty brand can be renamed and deleted.
    const lonely = await ctx.prisma.brand.create({ data: { name: 'Пустой бренд', slug: 'pustoy-brend' } });
    const brands = await request<AdminBrand[]>(api('/brands'), { headers: manager.read });
    expect(brands.body.find((brand) => brand.id === lonely.id)?.count).toBe(0);
    expect(brands.body.find((brand) => brand.id === original.id)?.count).toBeGreaterThan(1);
    const renamed = await request<AdminBrand>(api(`/brands/${lonely.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: { name: 'Новое имя' },
    });
    expect(renamed.body.name).toBe('Новое имя');
    const removed = await request(api(`/brands/${lonely.id}`), { method: 'DELETE', headers: manager.write });
    expect(removed.status).toBe(204);
  });

  it('keeps «О бренде» on the brand: one save shows it on every product of the brand', async () => {
    const text = 'Корейский бренд профессиональной косметики с 2010 года';
    const first = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: 'Первый товар бренда', brandName: 'Бренд О', brandDescription: text }),
    });
    expect(first.status).toBe(201);
    expect(first.body.brandDescription).toBe(text);

    // A product that sends no text (null) leaves the brand's text as it is.
    const second = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: 'Второй товар бренда', brandName: 'бренд о' }),
    });
    expect(second.body.brandDescription).toBe(text);
    const page = await request<ProductDetail>(ctx.url(`/v1/catalog/products/${second.body.slug}`));
    expect(page.body.brandDescription).toBe(text);
    const brands = await request<{ name: string; description: string }[]>(
      api(`/brands?q=${encodeURIComponent('Бренд О')}`),
      { headers: manager.read },
    );
    expect(brands.body.find((brand) => brand.name === 'Бренд О')?.description).toBe(text);

    // An empty text clears it for the whole brand.
    const cleared = await request<AdminProduct>(api(`/products/${second.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: product({ name: 'Второй товар бренда', brandName: 'Бренд О', brandDescription: '' }),
    });
    expect(cleared.status).toBe(200);
    const firstPage = await request<ProductDetail>(ctx.url(`/v1/catalog/products/${first.body.slug}`));
    expect(firstPage.body.brandDescription).toBe('');
  });

  it('plays a product video: saved from the editor, on the catalog card once ready, kept while in use', async () => {
    const video = await ctx.prisma.video.create({
      data: { libraryId: '777', externalId: `guid-${randomUUID()}`, status: 'processing', title: 'Тонер' },
    });
    const created = await request<AdminProduct>(api('/products'), {
      method: 'POST',
      headers: manager.write,
      json: product({ name: 'Тонер с видео', videoId: video.id }),
    });
    expect(created.status).toBe(201);
    expect(created.body.video?.id).toBe(video.id);
    // Still processing on Bunny: the site shows no video yet.
    const before = await request<ProductDetail>(ctx.url(`/v1/catalog/products/${created.body.slug}`));
    expect(before.body.video).toBeNull();

    await ctx.prisma.video.update({
      where: { id: video.id },
      data: {
        status: 'ready',
        durationSec: 42,
        thumbnailUrl: 'https://vz-test.b-cdn.net/x/thumbnail.jpg',
        hlsUrl: 'https://vz-test.b-cdn.net/x/playlist.m3u8',
        mp4Url: 'https://vz-test.b-cdn.net/x/play_720p.mp4',
      },
    });
    const cards = await request<ProductCard[]>(ctx.url('/v1/catalog/products'));
    expect(cards.body.find((card) => card.slug === created.body.slug)?.video).toMatchObject({
      id: video.id,
      durationSec: 42,
      mp4: 'https://vz-test.b-cdn.net/x/play_720p.mp4',
    });

    const inUse = await request<ErrorResponse>(api(`/videos/${video.id}`), {
      method: 'DELETE',
      headers: manager.write,
    });
    expect(inUse.status).toBe(409);
    const unknown = await request<ErrorResponse>(api(`/products/${created.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: product({ name: 'Тонер с видео', videoId: randomUUID() }),
    });
    expect(unknown.body.error.fields).toEqual({ videoId: 'video.not_found' });
    const removed = await request<AdminProduct>(api(`/products/${created.body.id}`), {
      method: 'PUT',
      headers: manager.write,
      json: product({ name: 'Тонер с видео', videoId: null }),
    });
    expect(removed.body.video).toBeNull();
  });

  it('serves the wholesale protocols PDF next to the brand catalog', async () => {
    const pdf = await ctx.prisma.media.create({
      data: { bucket: 'public', kind: 'pdf', status: 'ready', key: 'd/protocols.pdf', bytes: 2048 },
    });
    const current = await request<AdminContent>(api('/content/wholesale'), { headers: manager.read });
    const saved = await request<AdminContent>(api('/content/wholesale'), {
      method: 'PUT',
      headers: manager.write,
      json: { data: { ...current.body.data, protocolsMediaId: pdf.id } },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.media.map((item) => item.id)).toContain(pdf.id);
    const site = await request<{
      data: { protocolsMediaId: string };
      refs: { files: Record<string, unknown> };
    }>(ctx.url('/v1/content/wholesale'));
    expect(site.body.data.protocolsMediaId).toBe(pdf.id);
    expect(site.body.refs.files[pdf.id]).toBeDefined();
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
      quizGoal: 'calm',
      quizSkins: ['dry', 'dry'],
      published: false,
      inStock: true,
      itemIds: [b.id, a.id],
      steps: { am: [{ productId: a.id, text: 'Нанести утром' }], pm: [] },
      videoId: null,
      protocolMediaId: null,
      coverMediaId: null,
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
    // New screenshots go first, in upload order; the demo example is hidden.
    expect(created.body.map((r) => [r.media.id, r.isDemo, r.isHidden])).toEqual([
      [m1.id, false, false],
      [m2.id, false, false],
      [demoMedia.id, true, true],
    ]);
    const ids = created.body.map((r) => r.id);
    const reordered = await request<AdminReview[]>(api('/reviews/order'), {
      method: 'PUT',
      headers: manager.write,
      json: { ids: [ids[1], ids[0]] },
    });
    expect(reordered.body.map((r) => r.id)).toEqual([ids[1], ids[0], ids[2]]);
    const publicReviews = await request<{ id: string }[]>(ctx.url('/v1/reviews'));
    expect(publicReviews.body.map((r) => r.id)).toEqual([ids[1], ids[0]]);
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
