import { connection } from 'next/server';
import { env } from '@/env';

/** IndexNow key file (backend `indexnow.submit` points search engines here as keyLocation). */
export async function GET() {
  await connection();
  if (!env.INDEXNOW_KEY) return new Response('Not found', { status: 404 });
  return new Response(env.INDEXNOW_KEY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
