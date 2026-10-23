import { randomUUID } from 'node:crypto';
import type {
  AdminVideo,
  CreateOrderInput,
  CreateVideoResponse,
  ErrorResponse,
  NotificationTestResult,
} from '@bom/shared';
import { formatKgs } from '@bom/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MaintenanceService } from '../src/jobs/maintenance.service';
import { leadMessage, orderMessage } from '../src/notifications/messages';
import { bunnyTusSignature } from '../src/videos/bunny';
import { VideosService } from '../src/videos/videos.service';
import { createTestApp, loginAs, request, type AdminClient, type TestContext } from './app';

const realFetch = globalThis.fetch;
/** Captures outgoing calls to these hosts; everything else (the test's own requests) goes through. */
function interceptHosts(hosts: string[], reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!hosts.some((host) => url.includes(host))) return realFetch(input, init);
    calls.push({ url, body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null });
    return reply(url, init);
  });
  return calls;
}

const waitFor = async (check: () => boolean, ms = 5_000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describe('notification texts', () => {
  it('formats an order with escaped customer input and an admin link', () => {
    const message = orderMessage(
      {
        id: 'abc',
        number: 1041,
        lines: [{ type: 'program', title: 'Акне и постакне', qty: 2, totalKgs: 11800 }],
        totalKgs: 11800,
        name: 'Айгерим <script>',
        phone: '+996555123456',
        address: 'Бишкек, ул. Токтогула 1',
        comment: 'Позвонить & заехать',
        fromQuiz: true,
      },
      'https://admin.bom-beauty.com',
    );
    expect(message.subject).toBe('Новый заказ №1041');
    expect(message.html).toContain('Программа «Акне и постакне» × 2 · 11 800 сом');
    expect(message.html).toContain('Айгерим &lt;script&gt; · +996 555 12 34 56');
    expect(message.html).toContain('Позвонить &amp; заехать');
    expect(message.html).toContain('<a href="https://admin.bom-beauty.com/orders/abc">');
    expect(message.text).not.toContain('—');
  });

  it('lists every line of a cart order with the total', () => {
    const message = orderMessage(
      {
        id: 'abc',
        number: 1042,
        lines: [
          { type: 'product', title: 'Cica-сыворотка', qty: 2, totalKgs: 3800 },
          { type: 'product', title: 'Флюид SPF 50+', qty: 1, totalKgs: 1300 },
        ],
        totalKgs: 5100,
        name: 'Мээрим',
        phone: '+996555123456',
        address: 'Ош',
        comment: null,
        fromQuiz: false,
      },
      'https://admin.bom-beauty.com',
    );
    expect(message.text).toContain(
      `• Cica-сыворотка × 2 · ${formatKgs(3800)}\n• Флюид SPF 50+ × 1 · ${formatKgs(1300)}\nИтого: ${formatKgs(5100)}`,
    );
  });

  it('formats quiz and wholesale leads', () => {
    const quiz = leadMessage(
      {
        kind: 'quiz',
        answers: { goal: 'acne', skin: 'combo', exp: 'some', age: '25' },
        recommendedTitles: ['Акне'],
        choose: true,
      },
      'https://admin',
    );
    expect(quiz.text).toContain('Избавиться от высыпаний, чёрных точек и закрытых комедонов');
    expect(quiz.text).toContain('25–35 лет');
    expect(quiz.text).toContain('Подобрано: «Акне»');
    // Answers saved by the earlier quiz are skipped, not printed as "—".
    const old = leadMessage(
      {
        kind: 'quiz',
        answers: { skin: 'oily', goal: 'barrier', fmt: 'wa' },
        recommendedTitles: [],
        choose: false,
      },
      'https://admin',
    );
    expect(old.text).toContain('Появляется сильный жирный блеск по всему лицу');
    expect(old.text).not.toContain('—');
    expect(quiz.text).toContain('Просит помочь выбрать');
    const wholesale = leadMessage(
      { kind: 'wholesale', answers: { buyer: 'salon', country: 'kz' }, recommendedTitles: [], choose: false },
      'https://admin',
    );
    expect(wholesale.text).toContain('Салон\nКазахстан');
  });
});

describe('jobs: notifications, maintenance, Bunny video', () => {
  let ctx: TestContext;
  let owner: AdminClient;

  beforeAll(async () => {
    ctx = await createTestApp({
      TELEGRAM_BOT_TOKEN: 'test-token',
      BUNNY_LIBRARY_ID: '777',
      BUNNY_API_KEY: 'bunny-key',
      BUNNY_CDN_HOST: 'vz-test.b-cdn.net',
    });
    owner = await loginAs(ctx);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => ctx.close());

  it('sends a new order to Telegram when it is switched on', async () => {
    const calls = interceptHosts(['api.telegram.org'], () => new Response('{"ok":true}', { status: 200 }));
    await request(ctx.url('/v1/admin/settings/notifications'), {
      method: 'PUT',
      headers: owner.write,
      json: {
        value: {
          telegramEnabled: true,
          telegramChatId: '-1001',
          emailEnabled: false,
          email: null,
          notifyLeads: false,
        },
      },
    });
    const order: CreateOrderInput = {
      clientRef: randomUUID(),
      item: { type: 'product', slug: 'dr-sgn-cica-serum' },
      qty: 1,
      name: 'Тест',
      phone: '+996 555 12 34 56',
      address: 'Бишкек',
      message: 'Здравствуйте',
      pageUrl: 'http://localhost:3100/',
    };
    expect((await request(ctx.url('/v1/orders'), { method: 'POST', json: order })).status).toBe(201);
    // Saving the chat asked Telegram about it first (getChat); the order message follows.
    expect(calls[0]?.url).toBe('https://api.telegram.org/bottest-token/getChat');
    const sent = () => calls.find((call) => call.url.endsWith('/sendMessage'));
    await waitFor(() => sent() !== undefined);
    expect(sent()?.url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    expect(sent()?.body).toMatchObject({ chat_id: '-1001', parse_mode: 'HTML' });
    expect(JSON.stringify(sent()?.body)).toContain('Новый заказ №1001');

    const test = await request<NotificationTestResult>(ctx.url('/v1/admin/settings/notifications/test'), {
      method: 'POST',
      headers: owner.write,
    });
    expect(test.body).toEqual({ telegram: 'sent', email: 'off', error: null });
  });

  it('refuses a Telegram chat the bot cannot reach', async () => {
    const calls = interceptHosts(['api.telegram.org'], (_url, init) => {
      const { chat_id: chat } = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
        chat_id?: string;
      };
      return chat === '-1001'
        ? Response.json({ ok: true, result: { id: -1001, type: 'group', title: 'Заказы' } })
        : Response.json(
            { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
            { status: 400 },
          );
    });
    const save = (telegramChatId: string) =>
      request<ErrorResponse>(ctx.url('/v1/admin/settings/notifications'), {
        method: 'PUT',
        headers: owner.write,
        json: {
          value: {
            telegramEnabled: true,
            telegramChatId,
            emailEnabled: false,
            email: null,
            notifyLeads: false,
          },
        },
      });
    // A group id without its minus, and a @username: Telegram knows neither, so nothing is saved.
    for (const wrong of ['1001', '@someone']) {
      const res = await save(wrong);
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual({ 'value.telegramChatId': 'telegram.chat.not_found' });
    }
    expect((await save('-1001')).status).toBe(200);
    expect(calls.filter((call) => call.url.endsWith('/getChat'))).toHaveLength(3);

    // Telegram not answering never blocks the owner.
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('api.telegram.org')) throw new TypeError('fetch failed');
      return realFetch(input, init);
    });
    expect((await save('-1002')).status).toBe(200);
  });

  it('cleans up expired uploads and sessions', async () => {
    const stale = await ctx.prisma.media.create({
      data: {
        bucket: 'private',
        kind: 'image',
        status: 'pending',
        key: 'incoming/none',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const fresh = await ctx.prisma.media.create({
      data: {
        bucket: 'private',
        kind: 'image',
        status: 'pending',
        key: 'incoming/later',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const maintenance = ctx.app.get(MaintenanceService);
    expect(await maintenance.uploadsCleanup()).toBe(1);
    expect(await ctx.prisma.media.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await ctx.prisma.media.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    const user = await ctx.prisma.user.findFirstOrThrow();
    await ctx.prisma.session.create({
      data: { id: `expired-${randomUUID()}`, userId: user.id, expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await maintenance.sessionsCleanup()).toBe(1);
  });

  it('signs TUS uploads for Bunny and syncs a finished video', async () => {
    const calls = interceptHosts(['video.bunnycdn.com'], (url, init) => {
      if (init?.method === 'POST') return Response.json({ guid: 'guid-1' });
      return Response.json({
        guid: 'guid-1',
        status: 4,
        length: 183.4,
        width: 1080,
        height: 1920,
        thumbnailFileName: 'thumbnail.jpg',
        availableResolutions: '360p,480p,720p',
      });
    });
    const created = await request<CreateVideoResponse>(ctx.url('/v1/admin/videos'), {
      method: 'POST',
      headers: owner.write,
      json: { title: 'Акне', fileName: 'acne.mp4', size: 50_000_000 },
    });
    expect(created.status).toBe(201);
    const { headers } = created.body.tus;
    expect(headers.VideoId).toBe('guid-1');
    expect(headers.AuthorizationSignature).toBe(
      bunnyTusSignature('777', 'bunny-key', Number(headers.AuthorizationExpire), 'guid-1'),
    );
    expect(calls[0]?.body).toEqual({ title: 'Акне' });

    await ctx.app.get(VideosService).sync(created.body.video.id, 1);
    const video = await ctx.prisma.video.findUniqueOrThrow({ where: { id: created.body.video.id } });
    expect(video).toMatchObject({
      status: 'ready',
      durationSec: 183,
      hlsUrl: 'https://vz-test.b-cdn.net/guid-1/playlist.m3u8',
      mp4Url: 'https://vz-test.b-cdn.net/guid-1/play_720p.mp4',
      thumbnailUrl: 'https://vz-test.b-cdn.net/guid-1/thumbnail.jpg',
    });

    // The admin plays the video in place, so its card gets the playback URLs too.
    const card = await request<AdminVideo>(ctx.url(`/v1/admin/videos/${video.id}`), { headers: owner.read });
    expect(card.status).toBe(200);
    expect(card.body).toMatchObject({
      hlsUrl: 'https://vz-test.b-cdn.net/guid-1/playlist.m3u8',
      mp4Url: 'https://vz-test.b-cdn.net/guid-1/play_720p.mp4',
    });
  });
});
