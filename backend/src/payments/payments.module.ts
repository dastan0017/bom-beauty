import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { FinikClient } from './finik/finik.client';
import { FINIK_CONFIG, finikConfigFromEnv } from './finik/finik.config';
import { FinikMockController } from './finik/finik-mock.controller';
import { AdminPaymentsController, FinikWebhookController, PayController } from './payments.controllers';
import { PaymentsService } from './payments.service';

/**
 * Finik's configuration (keys loaded once at boot), its client and the payments service. Global, because the API
 * (orders, admin) and the worker (link expiry) both need them.
 */
@Global()
@Module({
  providers: [
    { provide: FINIK_CONFIG, useFactory: (env: Env) => finikConfigFromEnv(env), inject: [ENV] },
    FinikClient,
    PaymentsService,
  ],
  exports: [FINIK_CONFIG, FinikClient, PaymentsService],
})
export class PaymentsCoreModule {}

/** HTTP routes of online payment (API only). The mock Finik page exists only with FINIK_ENV=mock. */
@Module({})
export class PaymentsModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: PaymentsModule,
      controllers: [
        PayController,
        FinikWebhookController,
        AdminPaymentsController,
        ...(env.FINIK_ENV === 'mock' ? [FinikMockController] : []),
      ],
    };
  }
}
