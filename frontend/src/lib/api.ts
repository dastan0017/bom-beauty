import 'server-only';
import { connection } from 'next/server';
import type { z } from 'zod';
import { env } from '@/env';

/** Cache tags revalidated by the API after admin changes (docs/ARCHITECTURE.md §6.2). */
export const TAGS = {
  settings: 'settings',
  categories: 'categories',
  products: 'products',
  product: (slug: string) => `product:${slug}`,
  programs: 'programs',
  program: (slug: string) => `program:${slug}`,
  content: 'content',
  contentKey: (key: string) => `content:${key}`,
  reviews: 'reviews',
  redirects: 'redirects',
} as const;

export class ApiNotFoundError extends Error {}

/**
 * Server-side GET against the internal API URL. Pages render per request (so `next build` never needs the API),
 * while responses sit in Next's data cache until the API revalidates their tags. The shared secret exempts these
 * calls from the API's per-IP rate limit: every render comes from this one server.
 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  tags: string[],
): Promise<z.output<S>> {
  await connection();
  const response = await fetch(`${env.INTERNAL_API_URL}${path}`, {
    headers: { 'X-Internal-Secret': env.REVALIDATE_SECRET },
    next: { revalidate: 3600, tags },
  });
  if (response.status === 404) throw new ApiNotFoundError(path);
  if (!response.ok) throw new Error(`API ${response.status} for ${path}`);
  return schema.parse(await response.json());
}

/**
 * A fresh read that never enters the data cache (the payment page: its state changes within seconds). A 404 becomes
 * null.
 */
export async function apiGetFresh<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S> | null> {
  await connection();
  const response = await fetch(`${env.INTERNAL_API_URL}${path}`, {
    headers: { 'X-Internal-Secret': env.REVALIDATE_SECRET },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${response.status} for ${path}`);
  return schema.parse(await response.json());
}

/** Same as apiGet, but a 404 becomes null (for notFound() handling in pages). */
export async function apiGetOrNull<S extends z.ZodType>(
  path: string,
  schema: S,
  tags: string[],
): Promise<z.output<S> | null> {
  try {
    return await apiGet(path, schema, tags);
  } catch (error) {
    if (error instanceof ApiNotFoundError) return null;
    throw error;
  }
}
