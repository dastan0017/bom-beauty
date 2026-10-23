import { Module, type DynamicModule } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import type { Env } from '../config/env';
import { EnvModule } from '../config/env.module';
import { JobsModule } from '../jobs/jobs.module';
import { loggerModule } from '../logger/logger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsCoreModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RevalidateModule } from '../revalidate/revalidate.service';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.service';

/** BullMQ processors only (no HTTP). Started with `node dist/main.js --worker`. */
@Module({})
export class WorkerModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        EnvModule.forRoot(env),
        loggerModule(env),
        PrismaModule,
        SettingsModule,
        StorageModule,
        JobsModule.forRoot(env, { processors: true }),
        RevalidateModule,
        NotificationsModule,
        AuditModule,
        PaymentsCoreModule,
      ],
    };
  }
}
