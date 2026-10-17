import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/env';

// Called by the API worker after admin changes (docs/API.md §7): expires the cached API responses with these tags.

const bodySchema = z.object({ tags: z.array(z.string().min(1).max(200)).min(1).max(100) });

function secretMatches(header: string | null): boolean {
  if (!header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(env.REVALIDATE_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get('x-revalidate-secret'))) {
    return NextResponse.json({ error: { code: 'unauthenticated', message: 'Bad secret' } }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'Expected { tags: string[] }' } },
      { status: 400 },
    );
  }
  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: parsed.data.tags });
}
