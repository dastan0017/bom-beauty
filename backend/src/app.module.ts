import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AdminModule } from './admin/admin.module';
import { AdminCatalogModule } from './admin-catalog/admin-catalog.module';
import { AdminContentModule } from './admin-content/admin-content.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RealIpThrottlerGuard } from './common/throttler.guard';
import type { Env } from './config/env';
import { EnvModule } from './config/env.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './health/health.controller';
import { LeadsModule } from './leads/leads.module';
import { loggerModule } from './logger/logger.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedirectsModule } from './redirects/redirects.controller';
import { RedisModule } from './redis/redis.module';
import { RevalidateModule } from './revalidate/revalidate.service';
import { JobsModule } from './jobs/jobs.module';
import { AdminMediaModule } from './media/admin-media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.service';
import { ReviewsModule } from './reviews/reviews.controller';
import { SettingsModule } from './settings/settings.module';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EnvModule.forRoot(env),
        loggerModule(env),
        ThrottlerModule.forRoot({
          // Per-route limits override these (docs/API.md §3).
          throttlers: [
            { name: 'default', ttl: 60_000, limit: 120 },
            { name: 'hourly', ttl: 3_600_000, limit: 5_000 },
          ],
          skipIf: () => !env.THROTTLE_ENABLED,
        }),
        PrismaModule,
        RedisModule,
        AuditModule,
        JobsModule.forRoot(env, { processors: env.RUN_WORKER_IN_API }),
        StorageModule,
        RevalidateModule,
        NotificationsModule,
        SettingsModule,
        AuthModule,
        CatalogModule,
        ContentModule,
        ReviewsModule,
        RedirectsModule,
        OrdersModule,
        LeadsModule,
        AdminModule,
        AdminCatalogModule,
        AdminContentModule,
        AdminMediaModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_GUARD, useClass: RealIpThrottlerGuard },
      ],
    };
  }
}
