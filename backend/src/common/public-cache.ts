import { Header } from '@nestjs/common';

/** Browser caching for public catalog reads. Next.js uses its own tagged cache and ignores this. */
export const PublicCache = (): MethodDecorator =>
  Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
