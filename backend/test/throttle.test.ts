import type { ErrorResponse } from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, request, type TestContext } from './app';

describe('rate limits', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp({ THROTTLE_ENABLED: 'true' });
  });
  afterAll(() => ctx.close());

  it('allows 5 logins per minute per IP, then answers 429 in the API error format', async () => {
    const attempt = () =>
      request<ErrorResponse>(ctx.url('/v1/auth/login'), {
        method: 'POST',
        json: { email: 'nobody@test.kg', password: 'x' },
      });
    for (let i = 0; i < 5; i += 1) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers.get('retry-after')).toBeTruthy();
  });

  it('never limits health checks', async () => {
    for (let i = 0; i < 130; i += 1) await fetch(ctx.url('/health'));
    expect((await fetch(ctx.url('/health'))).status).toBe(200);
  });
});
