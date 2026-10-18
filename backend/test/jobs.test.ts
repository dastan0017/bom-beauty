import { randomUUID } from 'node:crypto';
import type { CreateOrderInput, CreateVideoResponse, NotificationTestResult } from '@bom/shared';
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
        itemTitle: 'Акне и проблемная кожа',
        itemType: 'program',
        qty: 2,
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
    expect(message.html).toContain('Программа «Акне и проблемная кожа» × 2 · 11 800 сом');
    expect(message.html).toContain('Айгерим &lt;script&gt; · +996 555 12 34 56');
    expect(message.html).toContain('Позвонить &amp; заехать');
    expect(message.html).toContain('<a href="https://admin.bom-beauty.com/orders/abc">');
    expect(message.text).not.toContain('—');
  });

  it('formats quiz and wholesale leads', () => {
    const quiz = leadMessage(
      { kind: 'quiz', answers: { skin: 'oily', goal: 'acne' }, recommendedTitles: ['Акне'], choose: true },
      'https://admin',
    );
    expect(quiz.text).toContain('Подобрано: «Акне»');
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
    await waitFor(() => calls.length > 0);
    expect(calls[0]?.url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    expect(calls[0]?.body).toMatchObject({ chat_id: '-1001', parse_mode: 'HTML' });
    expect(JSON.stringify(calls[0]?.body)).toContain('Новый заказ №1001');

    const test = await request<NotificationTestResult>(ctx.url('/v1/admin/settings/notifications/test'), {
      method: 'POST',
      headers: owner.write,
    });
    expect(test.body).toEqual({ telegram: 'sent', email: 'off', error: null });
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
  });
});
