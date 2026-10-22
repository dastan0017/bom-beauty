import { describe, expect, it, vi } from 'vitest';
import { refreshSite, SEED_TAGS } from './refresh-site';

const env = { WEB_INTERNAL_URL: 'http://web:3000', REVALIDATE_SECRET: 's'.repeat(16) };

describe('refreshSite (after the seed)', () => {
  it('expires the cached lists on the site with the shared secret', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(refreshSite(env, send)).resolves.toBe('Site cache refreshed');
    expect(send).toHaveBeenCalledOnce();
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe('http://web:3000/api/revalidate');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'X-Revalidate-Secret': env.REVALIDATE_SECRET });
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({ tags: SEED_TAGS });
    expect(SEED_TAGS).toEqual(expect.arrayContaining(['programs', 'products', 'content']));
  });

  it('never fails the seed', async () => {
    const down = vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(refreshSite(env, down)).resolves.toMatch(/not reachable/);
    const refused = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }));
    await expect(refreshSite(env, refused)).resolves.toMatch(/HTTP 401/);
    const send = vi.fn<typeof fetch>();
    await expect(refreshSite({}, send)).resolves.toMatch(/not set/);
    expect(send).not.toHaveBeenCalled();
  });
});
