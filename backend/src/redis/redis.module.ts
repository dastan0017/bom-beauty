import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      // Lazy: tooling that only builds the app (OpenAPI generation) never opens a connection.
      useFactory: (env: Env) => new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end' && this.redis.status !== 'wait') await this.redis.quit();
  }
}
