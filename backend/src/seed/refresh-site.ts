import { SITE_TAGS } from '../revalidate/site-tags';

/** Every list the site caches; the seed only adds rows, so the per-item tags of existing rows stay valid. */
export const SEED_TAGS = [
  SITE_TAGS.settings,
  SITE_TAGS.categories,
  SITE_TAGS.products,
  SITE_TAGS.programs,
  SITE_TAGS.content,
  SITE_TAGS.reviews,
];

/**
 * The seed writes to the database directly, so the site would keep its cached lists for up to an hour (new programs
 * missing from the home page). Expires them the way the worker does after an admin change. Best effort: an
 * unreachable site only means the cache runs out on its own.
 */
export async function refreshSite(
  env: { WEB_INTERNAL_URL?: string | undefined; REVALIDATE_SECRET?: string | undefined },
  send: typeof fetch = fetch,
): Promise<string> {
  const { WEB_INTERNAL_URL: web, REVALIDATE_SECRET: secret } = env;
  if (!web || !secret) return 'Site cache not refreshed: WEB_INTERNAL_URL or REVALIDATE_SECRET is not set';
  try {
    const response = await send(`${web}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Revalidate-Secret': secret },
      body: JSON.stringify({ tags: SEED_TAGS }),
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok
      ? 'Site cache refreshed'
      : `Site cache not refreshed (HTTP ${response.status}); it expires within an hour`;
  } catch {
    return 'Site not reachable; its cache expires within an hour';
  }
}
