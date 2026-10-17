import { Global, Inject, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';

/** Cache tags of the site (frontend/src/lib/api.ts). */
export const SITE_TAGS = {
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

const RETRY_DELAYS_MS = [1_000, 4_000, 15_000];

/**
 * Tells the site to drop cached API responses after an admin change (POST /api/revalidate on the web server).
 * Fire and forget with a few retries, so a restarting web container does not lose the update.
 * M5 moves this onto the BullMQ `web.revalidate` queue.
 */
@Injectable()
export class RevalidateService implements OnModuleDestroy {
  private readonly logger = new Logger(RevalidateService.name);
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  revalidate(tags: string[]): void {
    const unique = [...new Set(tags)];
    if (unique.length) void this.send(unique, 0);
  }

  private async send(tags: string[], attempt: number): Promise<void> {
    try {
      const response = await fetch(`${this.env.WEB_INTERNAL_URL}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Revalidate-Secret': this.env.REVALIDATE_SECRET },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        this.logger.warn(`Revalidation failed for ${tags.join(', ')}: ${String(error)}`);
        return;
      }
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.send(tags, attempt + 1);
      }, delay);
      timer.unref();
      this.timers.add(timer);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}

@Global()
@Module({ providers: [RevalidateService], exports: [RevalidateService] })
export class RevalidateModule {}
