import type { ErrorResponse } from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, loginAs, request, type AdminClient, type TestContext } from './app';

describe('rate limits', () => {
  let ctx: TestContext;
  let owner: AdminClient;
  beforeAll(async () => {
    ctx = await createTestApp({ THROTTLE_ENABLED: 'true' });
    owner = await loginAs(ctx);
  });
  afterAll(() => ctx.close());

  it('allows 5 logins per minute per IP, then answers 429 in the API error format', async () => {
    const attempt = () =>
      request<ErrorResponse>(ctx.url('/v1/auth/login'), {
        method: 'POST',
        json: { email: 'nobody@test.kg', password: 'x' },
      });
    // beforeAll used one login already.
    for (let i = 0; i < 4; i += 1) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers.get('retry-after')).toBeTruthy();
  });

  it('limits public reads per IP, but not the site server, which sends the internal secret', async () => {
    const read = (headers: Record<string, string> = {}) => fetch(ctx.url('/v1/settings/public'), { headers });
    const internal = { 'X-Internal-Secret': ctx.env.REVALIDATE_SECRET };
    for (let i = 0; i < 125; i += 1) expect((await read(internal)).status).toBe(200);
    expect((await read({ 'X-Internal-Secret': 'wrong-secret-of-some-length' })).status).toBe(200);
    for (let i = 0; i < 120; i += 1) await read();
    expect((await read()).status).toBe(429);
    expect((await read(internal)).status).toBe(200);
  });

  it('gives the admin 600 calls a minute per session (uploads come in bursts)', async () => {
    for (let i = 0; i < 150; i += 1) {
      const res = await fetch(ctx.url('/v1/admin/reviews'), { headers: owner.read });
      expect(res.status).toBe(200);
    }
  });

  it('never limits health checks', async () => {
    for (let i = 0; i < 130; i += 1) await fetch(ctx.url('/health'));
    expect((await fetch(ctx.url('/health'))).status).toBe(200);
  });
});
