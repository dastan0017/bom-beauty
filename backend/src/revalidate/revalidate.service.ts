import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { JobsService } from '../jobs/jobs.service';

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

/** Tells the site to drop cached API responses after an admin change, via the `web.revalidate` queue. */
@Injectable()
export class RevalidateService {
  constructor(
    private readonly jobs: JobsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  revalidate(tags: string[]): void {
    const unique = [...new Set(tags)];
    if (unique.length) void this.jobs.addSafely('web.revalidate', { tags: unique });
  }

  /** Asks search engines to recrawl changed pages (IndexNow, production only, when a key is set). */
  indexNow(paths: string[]): void {
    if (this.env.NODE_ENV !== 'production' || !this.env.INDEXNOW_KEY || !paths.length) return;
    void this.jobs.addSafely('indexnow.submit', { paths: [...new Set(paths)] }, { delay: 60_000 });
  }
}

/** Processor side: one attempt per call; BullMQ retries with backoff while the web container restarts. */
@Injectable()
export class RevalidateSender {
  private readonly logger = new Logger(RevalidateSender.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  async send(tags: string[]): Promise<void> {
    const response = await fetch(`${this.env.WEB_INTERNAL_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Revalidate-Secret': this.env.REVALIDATE_SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Revalidate HTTP ${response.status}`);
  }

  async indexNow(paths: string[]): Promise<void> {
    if (!this.env.INDEXNOW_KEY) return;
    const site = new URL(this.env.WEB_ORIGIN);
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: site.host,
        key: this.env.INDEXNOW_KEY,
        keyLocation: `${site.origin}/indexnow-key.txt`,
        urlList: paths.map((path) => new URL(path, site.origin).toString()),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 202) throw new Error(`IndexNow HTTP ${response.status}`);
    this.logger.log(`IndexNow: ${paths.length} URL(s)`);
  }
}

@Global()
@Module({ providers: [RevalidateService], exports: [RevalidateService] })
export class RevalidateModule {}
