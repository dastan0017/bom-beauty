import { Controller, Get, Header, HttpCode, Param, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  finikStatusSchema,
  payPageSchema,
  paymentCheckSchema,
  payStartSchema,
  payTokenSchema,
} from '@bom/shared';
import type { Request } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AdminAuth, CurrentSession } from '../auth/auth.guards';
import type { ActiveSession } from '../auth/session.service';
import { clientIp } from '../common/client-ip';
import { PaymentsService } from './payments.service';

class TokenParamsDto extends createZodDto(z.object({ token: payTokenSchema })) {}
class IdParamsDto extends createZodDto(z.object({ id: z.uuid() })) {}
class PayPageDto extends createZodDto(payPageSchema) {}
class PayStartDto extends createZodDto(payStartSchema) {}
class FinikStatusDto extends createZodDto(finikStatusSchema) {}
class PaymentCheckDto extends createZodDto(paymentCheckSchema) {}

/** The order's payment page (`/pay/<token>` on the site). The token is the only key; no personal data comes back. */
@ApiTags('public')
@Controller('pay')
export class PayController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ZodResponse({ type: PayPageDto })
  page(@Param() params: TokenParamsDto) {
    return this.payments.page(params.token);
  }

  /** Finik's page for the current amount (a live link is reused). */
  @Post(':token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 }, hourly: { limit: 60, ttl: 3_600_000 } })
  @ZodResponse({ type: PayStartDto })
  start(@Param() params: TokenParamsDto) {
    return this.payments.start(params.token);
  }
}

/**
 * Finik's payment webhook. Read through the raw request, with no DTO: the signature covers the body exactly as Finik
 * sent it, and the global zod pipe would rebuild it (docs/finik/SPEC.md §2.6).
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class FinikWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('finik')
  @HttpCode(200)
  async finik(@Req() request: RawBodyRequest<Request>): Promise<Record<string, never>> {
    await this.payments.webhook({
      rawBody: request.rawBody,
      headers: request.headers,
      host: request.headers.host,
      path: new URL(request.originalUrl, 'http://placeholder').pathname,
    });
    return {};
  }
}

/** «Настройки → Оплата»: connection state and the 1 сом check (owner only). */
@ApiTags('admin')
@AdminAuth('owner')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('finik')
  @ZodResponse({ type: FinikStatusDto })
  status() {
    return this.payments.finikStatus();
  }

  @Post('finik/check')
  @HttpCode(200)
  @ZodResponse({ type: PaymentCheckDto })
  check(@CurrentSession() session: ActiveSession, @Req() request: Request) {
    return this.payments.startCheck({ userId: session.user.id, ip: clientIp(request) });
  }

  @Get(':id')
  @ZodResponse({ type: PaymentCheckDto })
  checkStatus(@Param() params: IdParamsDto) {
    return this.payments.checkStatus(params.id);
  }
}
