import { Module, type DynamicModule } from '@nestjs/common';
import type { Env } from '../config/env';
import { EnvModule } from '../config/env.module';
import { loggerModule } from '../logger/logger.module';

/** BullMQ processors (M5). Started with `node dist/main.js --worker`. */
@Module({})
export class WorkerModule {
  static forRoot(env: Env): DynamicModule {
    return { module: WorkerModule, imports: [EnvModule.forRoot(env), loggerModule(env)] };
  }
}
