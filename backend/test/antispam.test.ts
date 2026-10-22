import { randomUUID } from 'node:crypto';
import type { CreateOrderInput, ErrorResponse } from '@bom/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp, loginAs, request, type TestContext } from './app';

const realFetch = globalThis.fetch;
const SITEVERIFY = 'challenges.cloudflare.com';

/** Answers Cloudflare's siteverify with `reply`; the test's own requests go through. */
function cloudflare(reply: (init?: RequestInit) => Promise<Response>) {
  const calls: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes(SITEVERIFY)) return realFetch(input, init);
    calls.push(init ?? {});
    return reply(init);
  });
  return calls;
}

describe('Turnstile on public submissions', () => {
  let ctx: TestContext;
  const order = (turnstileToken?: string): CreateOrderInput => ({
    clientRef: randomUUID(),
    items: [{ type: 'product', slug: 'dr-sgn-cica-serum', qty: 1 }],
    name: 'Тест',
    phone: '+996 555 12 34 56',
    address: 'Бишкек',
    message: 'Здравствуйте',
    pageUrl: 'http://localhost:3100/',
    ...(turnstileToken ? { turnstileToken } : {}),
  });
  const post = (body: CreateOrderInput) =>
    request<ErrorResponse>(ctx.url('/v1/orders'), { method: 'POST', json: body });

  beforeAll(async () => {
    ctx = await createTestApp({ TURNSTILE_SECRET_KEY: 'test-secret', TURNSTILE_SITE_KEY: 'test-site-key' });
    const owner = await loginAs(ctx);
    const res = await request(ctx.url('/v1/admin/settings/antispam'), {
      method: 'PUT',
      headers: owner.write,
      json: { value: { turnstileEnabled: true } },
    });
    expect(res.status).toBe(200);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => ctx.close());

  it('asks for a token and checks it with Cloudflare', async () => {
    const calls = cloudflare((init) => {
      const body = typeof init?.body === 'string' ? init.body : '{}';
      const { response } = JSON.parse(body) as { response?: string };
      return Promise.resolve(Response.json({ success: response === 'good' }));
    });
    expect((await post(order())).status).toBe(403);
    expect((await post(order('bad'))).status).toBe(403);
    expect((await post(order('good'))).status).toBe(201);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('lets orders through when Cloudflare does not answer in time', async () => {
    // Cloudflare never answers; the request is cut by its timeout signal (made to fire at once here).
    cloudflare(
      (init) =>
        new Promise((_, reject) => {
          const signal = init?.signal;
          const fail = () => reject(new Error('aborted by timeout'));
          if (signal?.aborted) fail();
          else signal?.addEventListener('abort', fail);
        }),
    );
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() =>
      AbortSignal.abort(new DOMException('timeout', 'TimeoutError')),
    );
    expect((await post(order('any'))).status).toBe(201);
  });
});
