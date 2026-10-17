import { Module, type DynamicModule } from '@nestjs/common';
import type { Env } from './config/env';
import { EnvModule } from './config/env.module';
import { HealthController } from './health/health.controller';
import { loggerModule } from './logger/logger.module';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [EnvModule.forRoot(env), loggerModule(env)],
      controllers: [HealthController],
    };
  }
}
