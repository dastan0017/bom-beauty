import { generateKeyPairSync, randomUUID, type KeyObject } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  formatKgs,
  type CreateOrderInput,
  type CreateOrderResponse,
  type ErrorResponse,
  type FinikStatus,
  type OrderDetail,
  type OrderList,
  type PaymentCheck,
  type PaymentsSetting,
  type PayPage,
  type PayStart,
  type PublicSettings,
} from '@bom/shared';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import type { NotifyTarget } from '../src/jobs/queues';
import { NotificationsService } from '../src/notifications/notifications.service';
import { canonicalString, signCanonical, verifyCanonical } from '../src/payments/finik/finik-signer';
import { PaymentsService } from '../src/payments/payments.service';
import {
  createManager,
  createTestApp,
  loginAs,
  MANAGER,
  request,
  type AdminClient,
  type TestContext,
} from './app';

// Online payment against a stubbed Finik (docs/finik/SPEC.md §8). Both key pairs are generated here: real keys are
// never read by tests (test/env.ts blanks FINIK_*).

const pem64 = (key: KeyObject, type: 'spki' | 'pkcs8') =>
  Buffer.from(key.export({ type, format: 'pem' }).toString()).toString('base64');
const ours = generateKeyPairSync('rsa', { modulusLength: 2048 }); // signs our requests to Finik
const finik = generateKeyPairSync('rsa', { modulusLength: 2048 }); // plays Finik: signs webhooks

const FINIK_HOST = 'beta.api.acquiring.averspay.kg';
const ACCOUNT_ID = '11111111-2222-3333-4444-555555555555';
const WEBHOOK = new URL('https://api.bom-test.kg/v1/webhooks/finik');
const FINIK_BETA = {
  FINIK_ENV: 'beta',
  FINIK_API_KEY: 'test-api-key',
  FINIK_ACCOUNT_ID: ACCOUNT_ID,
  FINIK_PRIVATE_KEY_BASE64: pem64(ours.privateKey, 'pkcs8'),
  FINIK_PUBLIC_KEY_BASE64: pem64(finik.publicKey, 'spki'),
  FINIK_WEBHOOK_URL: WEBHOOK.toString(),
  TELEGRAM_BOT_TOKEN: 'test-token',
};

interface Outgoing {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}
const realFetch = globalThis.fetch;
const sent = { finik: [] as Outgoing[], telegram: [] as Outgoing[] };
const redirectToFinik = (call: Outgoing) =>
  new Response(null, {
    status: 302,
    headers: { Location: `https://qr.finik.kg/pay/${String(call.body.PaymentId)}` },
  });
let finikAnswer: (call: Outgoing) => Response = redirectToFinik;

/** Captures calls to Finik and Telegram; the test's own requests to the app go through. */
function stubOutgoing(): void {
  sent.finik = [];
  sent.telegram = [];
  finikAnswer = redirectToFinik;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const { host } = new URL(url);
    if (host !== FINIK_HOST && host !== 'api.telegram.org') return realFetch(input, init);
    const call: Outgoing = {
      url,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: JSON.parse(typeof init?.body === 'string' ? init.body : 'null') as Record<string, unknown>,
    };
    if (host === FINIK_HOST) {
      sent.finik.push(call);
      return finikAnswer(call);
    }
    sent.telegram.push(call);
    return new Response('{"ok":true}', { status: 200 });
  });
}

interface TelegramMessage {
  text: string;
  reply_markup?: { inline_keyboard: { text: string; url: string }[][] };
}

/** The Telegram message that mentions `text` (jobs run in the test app; others may still be in flight). */
async function telegramWith(text: string, ms = 5_000): Promise<TelegramMessage> {
  const start = Date.now();
  for (;;) {
    const call = sent.telegram.find((c) => String(c.body.text).includes(text));
    if (call) return call.body as unknown as TelegramMessage;
    if (Date.now() - start > ms) throw new Error(`no Telegram message with "${text}"`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const kgs = formatKgs;

const orderInput = (overrides: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  clientRef: randomUUID(),
  items: [{ type: 'product', slug: 'dr-sgn-cica-serum', qty: 2 }], // 2 × 1 900 сом
  name: 'Айгерим',
  phone: '0555 12 34 56',
  address: 'Бишкек, ул. Токтогула 1',
  message: 'Здравствуйте! Хочу заказать…',
  pageUrl: 'http://localhost:3100/catalog/dr-sgn-cica-serum',
  paymentMethod: 'finik',
  ...overrides,
});

/** A Finik-like success webhook (shape of the published samples, docs/finik/SPEC.md §2.8). */
const paidEvent = (paymentId: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id: `${randomUUID()}_DEBIT`,
  transactionId: paymentId,
  status: 'SUCCEEDED',
  amount,
  fields: { amount, paymentId, qrTransactionId: randomUUID() },
  data: { accountId: ACCOUNT_ID, description: 'Заказ', name_en: 'Bom Beauty' },
  transactionDate: Date.now(),
  transactionType: 'DEBIT',
  receiptNumber: '000123',
  net: amount,
  ...extra,
});

/** Headers Finik sends: the signature covers our webhook host and path, the timestamp and the body. */
function signedHeaders(
  body: Record<string, unknown>,
  options: { at?: number; host?: string; key?: KeyObject } = {},
): Record<string, string> {
  const timestamp = String(options.at ?? Date.now());
  const signature = signCanonical(
    canonicalString({
      method: 'POST',
      path: WEBHOOK.pathname,
      host: options.host ?? WEBHOOK.host,
      headers: { 'x-api-timestamp': timestamp },
      body,
    }),
    options.key ?? finik.privateKey,
  );
  return { 'Content-Type': 'application/json', 'x-api-timestamp': timestamp, signature };
}

describe('online payment (Finik beta, stubbed)', () => {
  let ctx: TestContext;
  let owner: AdminClient;
  let manager: AdminClient;
  let enqueue: MockInstance<NotificationsService['enqueue']>;

  const placeOrder = (overrides: Partial<CreateOrderInput> = {}) =>
    request<CreateOrderResponse>(ctx.url('/v1/orders'), { method: 'POST', json: orderInput(overrides) });
  const deliver = (body: Record<string, unknown>, headers = signedHeaders(body)) =>
    request(ctx.url('/v1/webhooks/finik'), { method: 'POST', headers, body: JSON.stringify(body) });
  const attemptsOf = (orderId: string) =>
    ctx.prisma.payment.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const outcomes = (paymentId: string | null) =>
    ctx.prisma.paymentEvent
      .findMany({ where: { paymentId }, orderBy: { createdAt: 'asc' }, select: { outcome: true } })
      .then((events) => events.map((event) => event.outcome));
  const notified = (target: NotifyTarget) =>
    enqueue.mock.calls.filter(([call]) => isDeepStrictEqual(call, target)).length;
  const patchOrder = (id: string, json: Record<string, unknown>, as: AdminClient = owner) =>
    request<OrderDetail & ErrorResponse>(ctx.url(`/v1/admin/orders/${id}`), {
      method: 'PATCH',
      headers: as.write,
      json,
    });

  /** An online order with its first (live) Finik attempt. */
  async function onlineOrder(overrides: Partial<CreateOrderInput> = {}) {
    const res = await placeOrder(overrides);
    expect(res.status).toBe(201);
    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    const [attempt] = await attemptsOf(order.id);
    if (!attempt) throw new Error('no attempt');
    return { res, order, attempt };
  }

  async function setPayments(change: Partial<PaymentsSetting>): Promise<void> {
    const settings = await request<{ payments: PaymentsSetting }>(ctx.url('/v1/admin/settings'), {
      headers: owner.read,
    });
    const res = await request(ctx.url('/v1/admin/settings/payments'), {
      method: 'PUT',
      headers: owner.write,
      json: { value: { ...settings.body.payments, ...change } },
    });
    expect(res.status).toBe(200);
  }

  beforeAll(async () => {
    ctx = await createTestApp(FINIK_BETA);
    owner = await loginAs(ctx);
    await createManager(ctx);
    manager = await loginAs(ctx, MANAGER);
    const notifications = await request(ctx.url('/v1/admin/settings/notifications'), {
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
    expect(notifications.status).toBe(200);
  });
  beforeEach(() => {
    stubOutgoing();
    enqueue = vi.spyOn(ctx.app.get(NotificationsService), 'enqueue');
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => ctx.close());

  it('refuses an online order while the owner has not switched it on, and stores nothing', async () => {
    const body = orderInput();
    const res = await request<ErrorResponse>(ctx.url('/v1/orders'), { method: 'POST', json: body });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('payment_unavailable');
    expect(await ctx.prisma.order.count({ where: { clientRef: body.clientRef } })).toBe(0);
    expect(sent.finik).toHaveLength(0);
    const before = await request<PublicSettings>(ctx.url('/v1/settings/public'));
    expect(before.body.payments.finik).toBe(false);

    await setPayments({ finikEnabled: true });
    const after = await request<PublicSettings>(ctx.url('/v1/settings/public'));
    expect(after.body.payments).toEqual({ finik: true, defaultMethod: 'finik', visa: false });
  });

  it('creates an online order with one signed Finik call for the server amount', async () => {
    const body = { ...orderInput(), totalKgs: 1, priceKgs: 1 } as CreateOrderInput;
    const res = await request<CreateOrderResponse>(ctx.url('/v1/orders'), { method: 'POST', json: body });
    expect(res.status).toBe(201);
    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(order).toMatchObject({ totalKgs: 3800, paymentMethod: 'finik', paymentStatus: 'pending' });
    expect(order.payToken).toMatch(/^[0-9a-f]{32}$/);
    const [attempt, ...more] = await attemptsOf(order.id);
    expect(more).toHaveLength(0);
    expect(attempt).toMatchObject({
      purpose: 'order',
      environment: 'beta',
      status: 'pending',
      amountKgs: 3800,
    });
    const page = `${ctx.env.WEB_ORIGIN}/pay/${order.payToken}`;
    expect(res.body.payment).toEqual({ url: `https://qr.finik.kg/pay/${attempt?.id}`, page });

    expect(sent.finik).toHaveLength(1);
    const call = sent.finik[0];
    expect(call?.url).toBe(`https://${FINIK_HOST}/v1/payment`);
    expect(call?.headers['x-api-key']).toBe('test-api-key');
    expect(Math.abs(Number(call?.headers['x-api-timestamp']) - Date.now())).toBeLessThan(30_000);
    expect(call?.body).toEqual({
      Amount: 3800,
      CardType: 'FINIK_QR',
      Data: {
        accountId: ACCOUNT_ID,
        description: `Заказ №${order.number}`,
        endDate: attempt?.expiresAt.getTime(),
        name_en: expect.any(String) as unknown,
        webhookUrl: WEBHOOK.toString(),
      },
      Lang: 'ru',
      PaymentId: attempt?.id,
      RedirectUrl: `${page}?from=finik`,
    });
    const canonical = canonicalString({
      method: 'POST',
      path: '/v1/payment',
      host: FINIK_HOST,
      headers: { 'x-api-key': 'test-api-key', 'x-api-timestamp': call?.headers['x-api-timestamp'] ?? '' },
      body: call?.body ?? {},
    });
    expect(verifyCanonical(canonical, call?.headers.signature ?? '', ours.publicKey)).toBe(true);
    // The link lives for the configured TTL (60 minutes by default).
    expect((attempt?.expiresAt.getTime() ?? 0) - Date.now()).toBeGreaterThan(55 * 60_000);
    // The owner hears about an online order once it is paid or left unpaid, not at creation.
    expect(enqueue).not.toHaveBeenCalled();

    // A retried submission gets the same order and link; Finik is not called again.
    const again = await request<CreateOrderResponse>(ctx.url('/v1/orders'), { method: 'POST', json: body });
    expect(again.body).toEqual(res.body);
    expect(sent.finik).toHaveLength(1);
  });

  it('falls back to the pay page when Finik refuses, and the page gets a new link', async () => {
    finikAnswer = () => Response.json({ message: 'Forbidden' }, { status: 403 });
    const { res, order, attempt } = await onlineOrder();
    const page = `${ctx.env.WEB_ORIGIN}/pay/${order.payToken}`;
    expect(res.body.payment).toEqual({ url: null, page });
    expect(order.paymentStatus).toBe('unpaid');
    expect(attempt).toMatchObject({ status: 'failed', error: 'Finik 403: Forbidden', paymentUrl: null });

    const view = await request<PayPage>(ctx.url(`/v1/pay/${order.payToken}`));
    expect(view.status).toBe(200);
    expect(view.headers.get('cache-control')).toBe('no-store');
    expect(view.body).toEqual({
      number: order.number,
      lines: [{ type: 'product', title: 'Успокаивающая cica-сыворотка', qty: 2, totalKgs: 3800 }],
      totalKgs: 3800,
      adjustmentKgs: 0,
      adjustmentNote: null,
      amountKgs: 3800,
      status: 'unpaid',
      paidAt: null,
      canPay: true,
    });
    // The token is the only key: no name, phone or address comes back.
    expect(JSON.stringify(view.body)).not.toMatch(/Айгерим|555|Токтогула/);

    const refused = await request<ErrorResponse>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
    expect(refused.status).toBe(502);
    expect(refused.body.error.code).toBe('payment_failed');

    finikAnswer = redirectToFinik;
    const start = await request<PayStart>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
    expect(start.status).toBe(200);
    expect(start.headers.get('cache-control')).toBe('no-store');
    const attempts = await attemptsOf(order.id);
    expect(attempts.map((a) => a.status)).toEqual(['failed', 'failed', 'pending']);
    expect(start.body.url).toBe(`https://qr.finik.kg/pay/${attempts[2]?.id}`);
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'pending',
    );

    // A live link for the same amount is reused.
    const calls = sent.finik.length;
    const reuse = await request<PayStart>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
    expect(reuse.body.url).toBe(start.body.url);
    expect(sent.finik).toHaveLength(calls);
    expect((await request<PayPage>(ctx.url(`/v1/pay/${order.payToken}`))).body.status).toBe('pending');
  });

  it('answers 400 for a malformed token and 404 for an unknown one', async () => {
    expect((await request(ctx.url('/v1/pay/short'))).status).toBe(400);
    expect((await request(ctx.url('/v1/pay/bad%20token%20with%20spaces'))).status).toBe(400);
    const unknown = randomUUID().replaceAll('-', '');
    expect((await request(ctx.url(`/v1/pay/${unknown}`))).status).toBe(404);
    expect((await request(ctx.url(`/v1/pay/${unknown}`), { method: 'POST' })).status).toBe(404);
  });

  it('marks the order paid on a verified webhook, once, and sends the delivery text', async () => {
    const { order, attempt } = await onlineOrder();
    const event = paidEvent(attempt.id, 3800);
    const res = await deliver(event);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});

    const paid = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.paidAt?.getTime()).toBe(event.transactionDate);
    expect(await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: 'succeeded',
      channel: 'qr',
      paidAmountTyiyn: 380000,
      operationId: event.id,
      transactionId: attempt.id,
      receiptNumber: '000123',
    });
    expect(await outcomes(attempt.id)).toEqual(['applied']);
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { entity: 'order', entityId: order.id, action: 'payment' },
    });
    expect(audit).toMatchObject({ userId: null, diff: { from: 'pending', to: 'paid', source: 'finik' } });
    expect(notified({ entity: 'payment', id: attempt.id, event: 'paid' })).toBe(1);

    const message = await telegramWith(`✅ Заказ №${order.number} оплачен · ${kgs(3800)} · QR-код`);
    expect(message.text).toContain('📍 Доставка: Кыргызстан');
    expect(message.text).toContain('<blockquote><b>Клиент получит в WhatsApp:</b>');
    const button = message.reply_markup?.inline_keyboard[0]?.[0];
    expect(button?.text).toBe('💬 Написать о доставке');
    const wa = new URL(button?.url ?? '');
    expect(`${wa.origin}${wa.pathname}`).toBe('https://wa.me/996555123456');
    expect(wa.searchParams.get('text')).toBe(
      `Здравствуйте, Айгерим! Оплату за заказ №${order.number} получили, спасибо 🌸\n\n` +
        `В заказе:\n• Успокаивающая cica-сыворотка × 2 · ${kgs(3800)}\nОплачено: ${kgs(3800)}\n\n` +
        'Доставим по адресу: Бишкек, ул. Токтогула 1. Когда вам удобно принять заказ?',
    );

    // Finik delivers at least once: the same delivery changes nothing and notifies nobody.
    expect((await deliver(event)).status).toBe(200);
    expect(await outcomes(attempt.id)).toEqual(['applied']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'paid' })).toBe(1);

    const view = await request<PayPage>(ctx.url(`/v1/pay/${order.payToken}`));
    expect(view.body).toMatchObject({ status: 'paid', canPay: false, paidAt: paid.paidAt?.toISOString() });
    const again = await request<ErrorResponse>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('conflict');
  });

  it('stores Visa as the channel and uses the abroad template for a foreign phone', async () => {
    const { order, attempt } = await onlineOrder({ phone: '+7 701 123 45 67' });
    await deliver(paidEvent(attempt.id, 3800, { service: { id: 'VISA', name: 'Visa' } }));
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).channel).toBe('visa');
    const message = await telegramWith(`✅ Заказ №${order.number} оплачен · ${kgs(3800)} · Visa`);
    expect(message.text).toContain('🌍 Доставка: другая страна');
    expect(message.text).toContain('Отправим заказ в течение [...] дней');
  });

  it('rejects unsigned, forged, misaddressed and stale webhooks without storing anything', async () => {
    const { order, attempt } = await onlineOrder();
    const event = paidEvent(attempt.id, 3800);
    const { signature: _signature, ...unsigned } = signedHeaders(event);
    const tries = [
      unsigned,
      signedHeaders(event, { key: ours.privateKey }), // signed by someone else
      signedHeaders(event, { host: 'evil.example' }), // signed for another host
      signedHeaders(event, { at: Date.now() - 6 * 60_000 }), // replayed later
    ];
    for (const headers of tries) {
      const res = await deliver(event, headers);
      expect(res.status).toBe(401);
      expect((res.body as ErrorResponse).error.code).toBe('unauthenticated');
    }
    // A changed amount breaks the signature.
    expect((await deliver({ ...event, amount: 1 }, signedHeaders(event))).status).toBe(401);
    const broken = await fetch(ctx.url('/v1/webhooks/finik'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"id":',
    });
    expect(broken.status).toBe(400);

    expect(await ctx.prisma.paymentEvent.count({ where: { dedupeKey: event.id } })).toBe(0);
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'pending',
    );
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('records money for our account that matches no payment, and tells the owner', async () => {
    const event = paidEvent(randomUUID(), 500, {
      data: { accountId: ACCOUNT_ID, description: 'Заказ №9999', name_en: 'Bom Beauty' },
    });
    expect((await deliver(event)).status).toBe(200);
    const stored = await ctx.prisma.paymentEvent.findUniqueOrThrow({ where: { dedupeKey: event.id } });
    expect(stored).toMatchObject({ paymentId: null, outcome: 'unknown_payment', status: 'SUCCEEDED' });
    expect(notified({ entity: 'paymentEvent', id: stored.id, event: 'unknown' })).toBe(1);
    const message = await telegramWith('❗ Пришла оплата, которую сайт не нашёл');
    expect(message.text).toContain(`Сумма: ${kgs(500)}`);
    expect(message.text).toContain('Назначение: Заказ №9999');
  });

  it('never applies a payment made into another Finik account', async () => {
    // Someone with their own Finik merchant account reuses our PaymentId: Finik signs it, but the money is theirs.
    const { order, attempt } = await onlineOrder();
    const foreign = paidEvent(attempt.id, 3800, {
      data: { accountId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', description: 'Заказ', name_en: 'Other' },
    });
    expect((await deliver(foreign)).status).toBe(200);
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'pending',
    );
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe(
      'pending',
    );
    expect(await outcomes(attempt.id)).toEqual(['foreign_account']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'review', reason: 'account' })).toBe(1);
    await telegramWith('Счёт получателя в уведомлении Finik не совпал с вашим');

    // Without any account in the payload it is not applied either; the owner checks it.
    const missing = paidEvent(attempt.id, 3800, { data: undefined });
    await deliver(missing);
    expect(await outcomes(attempt.id)).toEqual(['foreign_account', 'unverified_account']);
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'pending',
    );

    // Another account and a payment we do not know: not ours at all, recorded quietly.
    const stranger = paidEvent(randomUUID(), 100, {
      data: { accountId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', description: 'x', name_en: 'Other' },
    });
    await deliver(stranger);
    const stored = await ctx.prisma.paymentEvent.findUniqueOrThrow({ where: { dedupeKey: stranger.id } });
    expect(stored).toMatchObject({ paymentId: null, outcome: 'foreign_account' });
    expect(enqueue.mock.calls.some(([target]) => target.entity === 'paymentEvent')).toBe(false);

    // The genuine payment still goes through.
    await deliver(paidEvent(attempt.id, 3800));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'paid',
    );
  });

  it('applies a webhook once when Finik delivers it twice at the same moment', async () => {
    const { order, attempt } = await onlineOrder();
    const event = paidEvent(attempt.id, 3800);
    const [first, second] = await Promise.all([deliver(event), deliver(event)]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await outcomes(attempt.id)).toEqual(['applied']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'paid' })).toBe(1);
    expect(
      await ctx.prisma.auditLog.count({ where: { entity: 'order', entityId: order.id, action: 'payment' } }),
    ).toBe(1);
  });

  it('keeps confirming payments after the owner switched online payment off', async () => {
    const { order, attempt } = await onlineOrder();
    await setPayments({ finikEnabled: false });
    try {
      // New payments stop at once; a link already paid on Finik's side still counts.
      const start = await request<ErrorResponse>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
      expect(start.body.error.code).toBe('payment_unavailable');
      expect((await deliver(paidEvent(attempt.id, 3800))).status).toBe(200);
      expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
        'paid',
      );
    } finally {
      await setPayments({ finikEnabled: true });
    }
  });

  it('keeps the payment when its notice cannot be queued', async () => {
    const { order, attempt } = await onlineOrder();
    enqueue.mockRejectedValue(new Error('queue down'));
    expect((await deliver(paidEvent(attempt.id, 3800))).status).toBe(200);
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'paid',
    );
    expect(await outcomes(attempt.id)).toEqual(['applied']);
  });

  it('a Finik timeout leaves the order payable, and a late payment of that attempt still counts', async () => {
    finikAnswer = () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    };
    const { res, order, attempt } = await onlineOrder();
    expect(res.body.payment).toEqual({ url: null, page: `${ctx.env.WEB_ORIGIN}/pay/${order.payToken}` });
    expect(order.paymentStatus).toBe('unpaid');
    expect(attempt).toMatchObject({ status: 'failed', error: 'timeout' });
    expect((await request<PayPage>(ctx.url(`/v1/pay/${order.payToken}`))).body).toMatchObject({
      status: 'unpaid',
      canPay: true,
    });
    // Finik may have created the payment before the timeout; if it is ever paid, the money is not lost.
    await deliver(paidEvent(attempt.id, 3800));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'paid',
    );
    expect(await outcomes(attempt.id)).toEqual(['applied']);
  });

  it('does not settle an order when the paid amount differs', async () => {
    const { order, attempt } = await onlineOrder();
    await deliver(paidEvent(attempt.id, 100));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'pending',
    );
    expect(await outcomes(attempt.id)).toEqual(['amount_mismatch']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'review', reason: 'amount' })).toBe(1);
    await telegramWith(`Пришло ${kgs(100)}, а заказ на ${kgs(3800)}.`);
  });

  it('never settles a new amount with a link issued before an adjustment', async () => {
    const { order, attempt: first } = await onlineOrder();
    const adjusted = await patchOrder(order.id, { adjustmentKgs: 200, adjustmentNote: 'Доставка' }, manager);
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.payment).toMatchObject({ status: 'unpaid', adjustmentKgs: 200, amountKgs: 4000 });

    // The old link was paid on Finik's side: the money arrives but the order still costs more.
    await deliver(paidEvent(first.id, 3800));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'unpaid',
    );
    expect(await outcomes(first.id)).toEqual(['amount_mismatch']);

    const view = await request<PayPage>(ctx.url(`/v1/pay/${order.payToken}`));
    expect(view.body).toMatchObject({ adjustmentKgs: 200, adjustmentNote: 'Доставка', amountKgs: 4000 });
    const start = await request<PayStart>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
    expect(start.status).toBe(200);
    expect(sent.finik.at(-1)?.body.Amount).toBe(4000);
    const second = (await attemptsOf(order.id)).at(-1);
    expect(second?.amountKgs).toBe(4000);
    await deliver(paidEvent(second?.id ?? '', 4000));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'paid',
    );
  });

  it('flags a second payment instead of applying it', async () => {
    const { order, attempt } = await onlineOrder();
    await deliver(paidEvent(attempt.id, 3800));
    const paidAt = (await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt;
    // Another operation on the same link.
    await deliver(paidEvent(attempt.id, 3800));
    expect(await outcomes(attempt.id)).toEqual(['applied', 'duplicate_payment']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'review', reason: 'double' })).toBe(1);

    // An order the owner already marked paid by hand.
    const other = await onlineOrder();
    expect((await patchOrder(other.order.id, { paymentStatus: 'paid' })).status).toBe(200);
    await deliver(paidEvent(other.attempt.id, 3800));
    expect(await outcomes(other.attempt.id)).toEqual(['duplicate_payment']);
    expect(notified({ entity: 'payment', id: other.attempt.id, event: 'review', reason: 'double' })).toBe(1);
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt).toEqual(paidAt);
  });

  it('pays a cancelled order but asks the owner to check it', async () => {
    const { order, attempt } = await onlineOrder();
    expect((await patchOrder(order.id, { status: 'cancelled' })).status).toBe(200);
    const view = await request<PayPage>(ctx.url(`/v1/pay/${order.payToken}`));
    expect(view.body).toMatchObject({ status: 'cancelled', canPay: false });
    const start = await request<ErrorResponse>(ctx.url(`/v1/pay/${order.payToken}`), { method: 'POST' });
    expect(start.status).toBe(409);

    await deliver(paidEvent(attempt.id, 3800));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'paid',
    );
    expect(await outcomes(attempt.id)).toEqual(['paid_cancelled']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'review', reason: 'cancelled' })).toBe(1);
  });

  it('keeps the payment of a deleted order and asks the owner to check it', async () => {
    const { order, attempt } = await onlineOrder();
    const removed = await request(ctx.url(`/v1/admin/orders/${order.id}`), {
      method: 'DELETE',
      headers: owner.write,
    });
    expect(removed.status).toBe(204);
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).orderId).toBeNull();
    await deliver(paidEvent(attempt.id, 3800));
    expect(await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: 'succeeded',
    });
    expect(await outcomes(attempt.id)).toEqual(['paid_deleted']);
    expect(notified({ entity: 'payment', id: attempt.id, event: 'review', reason: 'deleted' })).toBe(1);
  });

  it('marks the attempt failed on a FAILED webhook', async () => {
    const { order, attempt } = await onlineOrder();
    await deliver({ ...paidEvent(attempt.id, 3800), status: 'FAILED' });
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('failed');
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'unpaid',
    );
    expect(await outcomes(attempt.id)).toEqual(['failed']);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('expires links, reports an unpaid order once, and still accepts a late payment', async () => {
    const payments = ctx.app.get(PaymentsService);
    const { order, attempt } = await onlineOrder();
    const later = new Date(Date.now() + 2 * 3_600_000);
    const first = await payments.expire(later);
    expect(first.expired).toBeGreaterThan(0);
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe(
      'expired',
    );
    const unpaid = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unpaid).toMatchObject({ paymentStatus: 'unpaid', unpaidNotifiedAt: later });
    expect(notified({ entity: 'order', id: order.id, event: 'unpaid' })).toBe(1);
    const reminder = await telegramWith(`⏰ Заказ №${order.number} не оплачен · ${kgs(3800)}`);
    expect(reminder.reply_markup?.inline_keyboard[0]?.[0]?.text).toBe('💬 Отправить ссылку');

    await payments.expire(new Date(later.getTime() + 3_600_000));
    expect(notified({ entity: 'order', id: order.id, event: 'unpaid' })).toBe(1);

    // Finik retries webhooks for up to a day: a payment made just before the link ended still counts.
    await deliver(paidEvent(attempt.id, 3800));
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'paid',
    );
  });

  it('leaves the unpaid message out when the owner turned it off', async () => {
    await setPayments({ notifyUnpaid: false });
    const { order } = await onlineOrder();
    await ctx.app.get(PaymentsService).expire(new Date(Date.now() + 2 * 3_600_000));
    const row = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.paymentStatus).toBe('unpaid');
    expect(row.unpaidNotifiedAt).not.toBeNull();
    expect(notified({ entity: 'order', id: order.id, event: 'unpaid' })).toBe(0);
    await setPayments({ notifyUnpaid: true });
  });

  it('gives a WhatsApp order its payment link and lets the team settle it by hand', async () => {
    const res = await placeOrder({ paymentMethod: 'whatsapp' });
    expect(res.status).toBe(201);
    expect(res.body.payment).toBeNull();
    const id = res.body.id;
    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id } });
    expect(order).toMatchObject({ paymentMethod: 'whatsapp', paymentStatus: 'unpaid' });
    const payUrl = `${ctx.env.WEB_ORIGIN}/pay/${order.payToken}`;
    expect(notified({ entity: 'order', id })).toBe(1);
    const linkText =
      `Здравствуйте, Айгерим! Ваш заказ №${order.number}:\n• Успокаивающая cica-сыворотка × 2 · ${kgs(3800)}\n\n` +
      `К оплате: ${kgs(3800)}\nОплатить можно по ссылке: ${payUrl}`;
    const message = await telegramWith(`🛍 Заказ №${order.number} · через WhatsApp · не оплачен`);
    const button = message.reply_markup?.inline_keyboard[0]?.[0];
    expect(button?.text).toBe('💬 Отправить ссылку на оплату');
    expect(new URL(button?.url ?? '').searchParams.get('text')).toBe(linkText);

    const detail = await request<OrderDetail>(ctx.url(`/v1/admin/orders/${id}`), { headers: manager.read });
    expect(detail.body.payment).toEqual({
      method: 'whatsapp',
      status: 'unpaid',
      paidAt: null,
      adjustmentKgs: 0,
      adjustmentNote: null,
      amountKgs: 3800,
      payUrl,
      linkMessage: linkText,
      attempts: [],
    });

    const adjusted = await patchOrder(id, { adjustmentKgs: 300, adjustmentNote: ' Доставка ' }, manager);
    expect(adjusted.body.payment).toMatchObject({
      adjustmentKgs: 300,
      adjustmentNote: 'Доставка',
      amountKgs: 4100,
    });
    expect(adjusted.body.payment.linkMessage).toContain(
      `× 2 · ${kgs(3800)}\n• Доставка: +${kgs(300)}\n\nК оплате: ${kgs(4100)}`,
    );
    const tooLow = await patchOrder(id, { adjustmentKgs: -3800 }, manager);
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.error.fields).toEqual({ adjustmentKgs: 'order.adjustment.amount' });
    expect((await patchOrder(id, { paymentStatus: 'pending' })).status).toBe(400);
    expect((await patchOrder(id, {})).status).toBe(400);

    const paid = await patchOrder(id, { paymentStatus: 'paid' }, manager);
    expect(paid.status).toBe(200);
    expect(paid.body.payment.status).toBe('paid');
    expect(paid.body.payment.paidAt).not.toBeNull();
    expect(paid.body.history.find((entry) => entry.action === 'payment')).toMatchObject({
      payment: { from: 'unpaid', to: 'paid', source: 'manual' },
      userName: MANAGER.name,
    });
    const locked = await patchOrder(id, { adjustmentKgs: 0 }, manager);
    expect(locked.status).toBe(409);

    const list = await request<OrderList>(ctx.url('/v1/admin/orders?limit=50'), { headers: manager.read });
    expect(list.body.items.find((row) => row.id === id)).toMatchObject({
      paymentMethod: 'whatsapp',
      paymentStatus: 'paid',
    });
    const csv = await (await fetch(ctx.url('/v1/admin/orders/export.csv'), { headers: owner.read })).text();
    const [header, ...rows] = csv.split('\r\n');
    expect(header?.endsWith(';Оплата;Статус оплаты;Дата оплаты;К оплате, сом')).toBe(true);
    expect(rows.find((row) => row.startsWith(`${order.number};`))).toMatch(/;WhatsApp;Оплачен;[^;]+;4100$/);
  });

  it('reads templates saved before {состав} existed as the new defaults, keeping edited ones', async () => {
    const edited = 'Салам, {имя}! Заказ №{заказ}, {сумма}: {ссылка}';
    await setPayments({
      templates: {
        link: edited,
        paidLocal:
          'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸 Доставим по адресу: {адрес}. Когда вам удобно принять заказ?',
        paidAbroad:
          'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸 Отправим заказ в течение [...] дней, трек-номер пришлём сюда.',
      },
    });
    const settings = await request<{ payments: PaymentsSetting }>(ctx.url('/v1/admin/settings'), {
      headers: owner.read,
    });
    expect(settings.body.payments.templates).toEqual({
      link: edited,
      paidLocal: DEFAULT_WHATSAPP_TEMPLATES.paidLocal,
      paidAbroad: DEFAULT_WHATSAPP_TEMPLATES.paidAbroad,
    });
    await setPayments({ templates: { ...DEFAULT_WHATSAPP_TEMPLATES } });
  });

  it('lets only the owner read the connection and run the 1 сом check', async () => {
    expect((await request(ctx.url('/v1/admin/payments/finik'), { headers: manager.read })).status).toBe(403);
    expect(
      (await request(ctx.url('/v1/admin/payments/finik/check'), { method: 'POST', headers: manager.write }))
        .status,
    ).toBe(403);

    const status = await request<FinikStatus>(ctx.url('/v1/admin/payments/finik'), { headers: owner.read });
    expect(status.body).toEqual({
      configured: true,
      environment: 'beta',
      accountId: '1111…5555',
      webhookUrl: WEBHOOK.toString(),
    });

    const check = await request<PaymentCheck>(ctx.url('/v1/admin/payments/finik/check'), {
      method: 'POST',
      headers: owner.write,
    });
    expect(check.status).toBe(200);
    expect(check.body).toMatchObject({ status: 'pending', url: `https://qr.finik.kg/pay/${check.body.id}` });
    expect(sent.finik.at(-1)?.body).toMatchObject({
      Amount: 1,
      RedirectUrl: `${ctx.env.ADMIN_ORIGIN}/settings/payments?check=${check.body.id}`,
      Data: { description: 'Проверка подключения' },
    });
    expect(
      await ctx.prisma.auditLog.count({
        where: { entity: 'payment', entityId: check.body.id, action: 'check' },
      }),
    ).toBe(1);

    await deliver(paidEvent(check.body.id, 1));
    const done = await request<PaymentCheck>(ctx.url(`/v1/admin/payments/${check.body.id}`), {
      headers: owner.read,
    });
    expect(done.body).toMatchObject({ status: 'succeeded', url: null, error: null });
    expect(done.body.paidAt).not.toBeNull();
    expect(await outcomes(check.body.id)).toEqual(['check_paid']);
    expect(notified({ entity: 'payment', id: check.body.id, event: 'check_paid' })).toBe(1);
    // An order attempt is not a check.
    const { attempt } = await onlineOrder();
    expect((await request(ctx.url(`/v1/admin/payments/${attempt.id}`), { headers: owner.read })).status).toBe(
      404,
    );
  });

  it('serves no mock Finik routes outside mock mode', async () => {
    expect((await request(ctx.url(`/v1/dev/finik/pay/${randomUUID()}`))).status).toBe(404);
  });
});

describe('online payment, not configured', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('stays off even when the setting is on', async () => {
    const owner = await loginAs(ctx);
    const settings = await request<{ payments: PaymentsSetting }>(ctx.url('/v1/admin/settings'), {
      headers: owner.read,
    });
    await request(ctx.url('/v1/admin/settings/payments'), {
      method: 'PUT',
      headers: owner.write,
      json: { value: { ...settings.body.payments, finikEnabled: true } },
    });
    expect((await request<PublicSettings>(ctx.url('/v1/settings/public'))).body.payments.finik).toBe(false);
    const res = await request<ErrorResponse>(ctx.url('/v1/orders'), { method: 'POST', json: orderInput() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('payment_unavailable');
    expect((await request(ctx.url('/v1/webhooks/finik'), { method: 'POST', json: {} })).status).toBe(503);
    const status = await request<FinikStatus>(ctx.url('/v1/admin/payments/finik'), { headers: owner.read });
    expect(status.body).toEqual({ configured: false, environment: null, accountId: null, webhookUrl: null });
  });
});

describe('online payment, mock mode', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp({
      FINIK_ENV: 'mock',
      FINIK_WEBHOOK_URL: 'http://localhost:4000/v1/webhooks/finik',
    });
    const owner = await loginAs(ctx);
    const settings = await request<{ payments: PaymentsSetting }>(ctx.url('/v1/admin/settings'), {
      headers: owner.read,
    });
    await request(ctx.url('/v1/admin/settings/payments'), {
      method: 'PUT',
      headers: owner.write,
      json: { value: { ...settings.body.payments, finikEnabled: true } },
    });
  });
  afterAll(() => ctx.close());

  it('pays an order through the fake Finik page and a webhook verified over HTTP', async () => {
    const res = await request<CreateOrderResponse>(ctx.url('/v1/orders'), {
      method: 'POST',
      json: orderInput(),
    });
    expect(res.status).toBe(201);
    const [attempt] = await ctx.prisma.payment.findMany({ where: { orderId: res.body.id } });
    expect(attempt?.environment).toBe('mock');
    expect(res.body.payment?.url).toBe(`http://localhost:4000/v1/dev/finik/pay/${attempt?.id}`);

    const page = await fetch(ctx.url(`/v1/dev/finik/pay/${attempt?.id}`));
    const html = await page.text();
    expect(html).toContain('Finik · тестовый режим');
    expect(html).toContain(kgs(3800));

    const pay = await fetch(ctx.url(`/v1/dev/finik/pay/${attempt?.id}`), {
      method: 'POST',
      redirect: 'manual',
    });
    expect(pay.status).toBe(303);
    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(pay.headers.get('location')).toBe(`${ctx.env.WEB_ORIGIN}/pay/${order.payToken}?from=finik`);
    expect(order.paymentStatus).toBe('paid');
    expect(
      await ctx.prisma.paymentEvent.findFirstOrThrow({
        where: { paymentId: attempt?.id },
        select: { outcome: true },
      }),
    ).toEqual({ outcome: 'applied' });
    // The fake page closes once paid.
    expect(await (await fetch(ctx.url(`/v1/dev/finik/pay/${attempt?.id}`))).text()).toContain(
      'Ссылка не активна',
    );
  });
});
