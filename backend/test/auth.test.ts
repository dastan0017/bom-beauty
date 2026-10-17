import type { AuthSession, ErrorResponse } from '@bom/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, OWNER, request, type TestContext } from './app';

describe('auth', () => {
  let ctx: TestContext;
  const admin = () => ({ Origin: ctx.env.ADMIN_ORIGIN });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  async function login(
    remember = false,
  ): Promise<{ cookie: string; session: AuthSession; setCookie: string }> {
    const res = await request<AuthSession>(ctx.url('/v1/auth/login'), {
      method: 'POST',
      headers: admin(),
      json: { email: OWNER.email.toUpperCase(), password: OWNER.password, remember },
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('bb_sid=')) ?? '';
    return { cookie: setCookie.split(';')[0] ?? '', session: res.body, setCookie };
  }

  it('rejects a wrong password with a generic error', async () => {
    const res = await request<ErrorResponse>(ctx.url('/v1/auth/login'), {
      method: 'POST',
      json: { email: OWNER.email, password: 'wrong' },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('logs in, sets an HttpOnly cookie and answers /me', async () => {
    const { cookie, session, setCookie } = await login(true);
    expect(session.user).toMatchObject({ email: OWNER.email, role: 'owner' });
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    const me = await request<AuthSession>(ctx.url('/v1/auth/me'), { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect(me.body.csrfToken).toBe(session.csrfToken);
  });

  it('sends hardening headers and keeps admin answers out of caches', async () => {
    const { cookie } = await login();
    const me = await request(ctx.url('/v1/auth/me'), { headers: { Cookie: cookie } });
    expect(me.headers.get('cache-control')).toBe('no-store');
    expect(me.headers.get('x-content-type-options')).toBe('nosniff');
    const orders = await request(ctx.url('/v1/admin/orders'), { headers: { Cookie: cookie } });
    expect(orders.headers.get('cache-control')).toBe('no-store');
    const site = await request(ctx.url('/v1/settings/public'));
    expect(site.headers.get('cache-control')).not.toBe('no-store');
    expect(site.headers.get('x-frame-options')).toBe('DENY');
    expect(site.headers.get('x-powered-by')).toBeNull();
  });

  it('stores only a hash of the session token', async () => {
    const { cookie } = await login();
    const token = cookie.split('=')[1] ?? '';
    expect(await ctx.prisma.session.findUnique({ where: { id: token } })).toBeNull();
  });

  it('requires the admin Origin and the CSRF token on mutations', async () => {
    const { cookie, session } = await login();
    const noToken = await request<ErrorResponse>(ctx.url('/v1/auth/logout'), {
      method: 'POST',
      headers: { ...admin(), Cookie: cookie },
    });
    expect(noToken.body.error.code).toBe('csrf_failed');
    const wrongOrigin = await request<ErrorResponse>(ctx.url('/v1/auth/logout'), {
      method: 'POST',
      headers: { Origin: 'https://evil.example', Cookie: cookie, 'X-CSRF-Token': session.csrfToken },
    });
    expect(wrongOrigin.body.error.code).toBe('origin_mismatch');
    const ok = await request(ctx.url('/v1/auth/logout'), {
      method: 'POST',
      headers: { ...admin(), Cookie: cookie, 'X-CSRF-Token': session.csrfToken },
    });
    expect(ok.status).toBe(204);
    const after = await request(ctx.url('/v1/auth/me'), { headers: { Cookie: cookie } });
    expect(after.status).toBe(401);
  });

  it('refuses deactivated users', async () => {
    const { cookie } = await login();
    await ctx.prisma.user.update({ where: { email: OWNER.email }, data: { isActive: false } });
    expect((await request(ctx.url('/v1/auth/me'), { headers: { Cookie: cookie } })).status).toBe(401);
    await ctx.prisma.user.update({ where: { email: OWNER.email }, data: { isActive: true } });
  });

  it('locks an email after 10 failed attempts', async () => {
    const attempt = () =>
      request<ErrorResponse>(ctx.url('/v1/auth/login'), {
        method: 'POST',
        json: { email: 'locked@test.kg', password: 'x' },
      });
    for (let i = 0; i < 10; i += 1) expect((await attempt()).status).toBe(401);
    const locked = await attempt();
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('rate_limited');
  });
});
