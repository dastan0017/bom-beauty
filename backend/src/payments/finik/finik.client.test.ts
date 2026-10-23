import { generateKeyPairSync } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env';
import { canonicalString, verifyCanonical } from './finik-signer';
import { FinikClient, type CreatePaymentInput } from './finik.client';
import { finikConfigFromEnv } from './finik.config';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem64 = Buffer.from(
  pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
).toString('base64');
const API_KEY = 'secret-api-key';
const PAGE = 'https://qr.finik.kg/pay/abc?failure_redirect_url=x';

/** Only the FINIK_* part of the env matters to the Finik config. */
const client = (environment: 'beta' | 'prod' | 'mock') =>
  new FinikClient(
    finikConfigFromEnv({
      FINIK_ENV: environment,
      FINIK_API_KEY: API_KEY,
      FINIK_ACCOUNT_ID: 'account-1',
      FINIK_PRIVATE_KEY_BASE64: privatePem64,
      FINIK_WEBHOOK_URL: 'https://api.bom-beauty.com/v1/webhooks/finik',
    } as Env),
  );

const input: CreatePaymentInput = {
  paymentId: '0199f0a4-0000-7000-8000-000000000001',
  amountKgs: 5900,
  description: 'Заказ №1042',
  redirectUrl: 'https://bom-beauty.com/pay/token?from=finik',
  expiresAt: new Date('2026-10-23T12:00:00Z'),
  qrName: 'Bom Beauty',
};

describe('FinikClient.createPayment', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let logs: string[];

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    logs = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
        logs.push(String(message));
      });
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const lastCall = () => {
    const [target, init] = fetchMock.mock.calls.at(-1) ?? [];
    const body = typeof init?.body === 'string' ? init.body : '';
    return {
      url: target instanceof Request ? target.url : (target?.toString() ?? ''),
      init: init ?? {},
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
      json: JSON.parse(body || 'null') as Record<string, unknown>,
    };
  };

  it('sends a signed request and returns the 302 Location', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { Location: PAGE } }));
    expect(await client('prod').createPayment(input)).toEqual({ ok: true, url: PAGE });

    const call = lastCall();
    expect(call.url).toBe('https://api.acquiring.averspay.kg/v1/payment');
    expect(call.init).toMatchObject({ method: 'POST', redirect: 'manual' });
    expect(call.headers).toMatchObject({ 'content-type': 'application/json', 'x-api-key': API_KEY });
    // The body goes out exactly as signed: top-level keys sorted, nested ones as built.
    expect(call.body).toBe(
      JSON.stringify({
        Amount: 5900,
        CardType: 'FINIK_QR',
        Data: {
          accountId: 'account-1',
          name_en: 'Bom Beauty',
          webhookUrl: 'https://api.bom-beauty.com/v1/webhooks/finik',
          description: 'Заказ №1042',
          endDate: input.expiresAt.getTime(),
        },
        Lang: 'ru',
        PaymentId: input.paymentId,
        RedirectUrl: input.redirectUrl,
      }),
    );
    const canonical = canonicalString({
      method: 'POST',
      path: '/v1/payment',
      host: 'api.acquiring.averspay.kg',
      headers: { 'x-api-key': API_KEY, 'x-api-timestamp': call.headers['x-api-timestamp'] ?? '' },
      body: call.json,
    });
    expect(verifyCanonical(canonical, call.headers.signature ?? '', pair.publicKey)).toBe(true);
  });

  it('uses the beta host for beta and a fresh timestamp per call', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { Location: PAGE } })),
    );
    const finik = client('beta');
    await finik.createPayment(input);
    const first = lastCall();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await finik.createPayment(input);
    const second = lastCall();
    expect(first.url).toBe('https://beta.api.acquiring.averspay.kg/v1/payment');
    expect(Number(second.headers['x-api-timestamp'])).toBeGreaterThan(
      Number(first.headers['x-api-timestamp']),
    );
  });

  it('reads the newer 201 JSON answer', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ paymentId: input.paymentId, paymentUrl: PAGE }, { status: 201 }),
    );
    expect(await client('prod').createPayment(input)).toEqual({ ok: true, url: PAGE });
  });

  it.each([
    [400, { StatusCode: 400, ErrorMessage: 'Amount is required' }, 'Amount is required'],
    [401, { statusCode: 401, ErrorMessage: 'Invalid signature' }, 'Invalid signature'],
    [403, { message: 'Forbidden' }, 'Forbidden'],
    [502, 'Bad Gateway', 'Bad Gateway'],
  ])('turns HTTP %i into a typed failure', async (status, body, message) => {
    fetchMock.mockResolvedValue(
      typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }),
    );
    expect(await client('prod').createPayment(input)).toEqual({ ok: false, reason: 'http', status, message });
  });

  it('reports a timeout and a network failure', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    expect(await client('prod').createPayment(input)).toEqual({ ok: false, reason: 'timeout' });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await client('prod').createPayment(input)).toEqual({ ok: false, reason: 'network' });
  });

  it('refuses a payment page that is not https', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: 'http://qr.finik.kg/pay/abc' } }),
    );
    expect(await client('prod').createPayment(input)).toMatchObject({ ok: false, reason: 'bad_url' });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302 }));
    expect(await client('prod').createPayment(input)).toMatchObject({ ok: false, reason: 'bad_url' });
  });

  it('never logs the API key, the signature or the payment link', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: PAGE } }));
    await client('prod').createPayment(input);
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Forbidden' }, { status: 403 }));
    await client('prod').createPayment(input);
    const signature = lastCall().headers.signature ?? '';
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain(API_KEY);
      expect(line).not.toContain(signature);
      expect(line).not.toContain('/pay/abc');
      expect(line).not.toContain('5900');
    }
  });

  it('answers with the local fake page in mock mode, without calling anyone', async () => {
    expect(await client('mock').createPayment(input)).toEqual({
      ok: true,
      url: `https://api.bom-beauty.com/v1/dev/finik/pay/${input.paymentId}`,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
