import { randomUUID } from 'node:crypto';
import { Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { formatKgs } from '@bom/shared';
import type { Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { escapeHtml } from '../../notifications/messages';
import { payPageUrl } from '../pay-url';
import { canonicalString, signCanonical } from './finik-signer';
import { FINIK_CONFIG, type FinikConfig } from './finik.config';

class IdParamsDto extends createZodDto(z.object({ id: z.uuid() })) {}

/** Path of our own webhook route; the mock posts to it on the API that served the page. */
const WEBHOOK_PATH = '/v1/webhooks/finik';

/**
 * FINIK_ENV=mock only (development and e2e; env.ts refuses it in production). Plays Finik: a payment page and, on
 * «Оплатить», a webhook signed like Finik's that goes through the real verification path over HTTP
 * (docs/finik/SPEC.md §5.11).
 */
@ApiExcludeController()
@Controller('dev/finik')
export class FinikMockController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FINIK_CONFIG) private readonly config: FinikConfig,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('pay/:id')
  async page(@Param() params: IdParamsDto, @Res() response: Response): Promise<void> {
    const payment = await this.load(params.id);
    const open = payment.status === 'pending' && payment.expiresAt > new Date();
    response
      .type('html')
      .send(
        mockPage(
          payment.order ? `Заказ №${payment.order.number}` : 'Проверка подключения',
          formatKgs(payment.amountKgs),
          open,
          this.env.WEB_ORIGIN,
          params.id,
        ),
      );
  }

  @Post('pay/:id')
  async pay(@Param() params: IdParamsDto, @Req() request: Request, @Res() response: Response): Promise<void> {
    const payment = await this.load(params.id);
    const { mockFinikKey, webhookUrl, accountId } = this.config;
    if (!mockFinikKey || !webhookUrl) throw notFound();

    const operation = randomUUID();
    const body = {
      id: `mock_${operation}_DEBIT`,
      transactionId: payment.id,
      status: 'SUCCEEDED',
      amount: payment.amountKgs,
      fields: { amount: payment.amountKgs, paymentId: payment.id, qrTransactionId: operation },
      data: { accountId, webhookUrl: webhookUrl.toString(), name_en: 'Bom Beauty' },
      transactionDate: Date.now(),
      transactionType: 'DEBIT',
    };
    const timestamp = Date.now().toString();
    // Signed for the configured webhook URL, as Finik would; the verifier tries that host and path first.
    const signature = signCanonical(
      canonicalString({
        method: 'POST',
        path: webhookUrl.pathname,
        host: webhookUrl.host,
        headers: { 'x-api-timestamp': timestamp },
        body,
      }),
      mockFinikKey,
    );
    const delivered = await fetch(`${request.protocol}://${request.get('host')}${WEBHOOK_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-timestamp': timestamp, signature },
      body: JSON.stringify(body),
    });
    if (!delivered.ok) {
      response.status(502).type('html').send(`<p>Webhook вернул ${delivered.status}</p>`);
      return;
    }
    const back = payment.order
      ? `${payPageUrl(this.env.WEB_ORIGIN, payment.order.payToken)}?from=finik`
      : `${this.env.ADMIN_ORIGIN}/settings/payments?check=${payment.id}`;
    response.redirect(303, back);
  }

  private async load(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        amountKgs: true,
        status: true,
        expiresAt: true,
        order: { select: { number: true, payToken: true } },
      },
    });
    if (!payment) throw notFound('Платёж не найден');
    return payment;
  }
}

function mockPage(title: string, amount: string, open: boolean, shop: string, id: string): string {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Finik · тестовая оплата</title>
<style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f4f2fb;color:#14142b;display:flex;justify-content:center}
main{width:100%;max-width:420px;padding:32px 20px}
.card{background:#fff;border-radius:20px;padding:24px;box-shadow:0 8px 30px rgba(20,20,43,.08)}
.badge{display:inline-block;background:#efe9ff;color:#6a3be0;font-weight:700;font-size:13px;border-radius:99px;padding:4px 12px}
h1{font-size:22px;margin:14px 0 4px}.amount{font-size:34px;font-weight:700;margin:8px 0 20px}
button{width:100%;height:52px;border:0;border-radius:14px;background:#8049ff;color:#fff;font:600 17px system-ui,sans-serif;cursor:pointer}
a{display:block;text-align:center;margin-top:16px;color:#5b5f7a}
</style></head>
<body><main><div class="card">
<span class="badge">Finik · тестовый режим</span>
<h1>${escapeHtml(title)}</h1>
<div class="amount">${escapeHtml(amount)}</div>
${
  open
    ? `<form method="post" action="/v1/dev/finik/pay/${id}"><button type="submit">Оплатить</button></form>`
    : '<p>Ссылка не активна: платёж уже прошёл, истёк или не создан.</p>'
}
<a href="${escapeHtml(shop)}">Вернуться в магазин</a>
</div><p style="text-align:center;color:#8a8fa8;font-size:13px">Деньги не списываются: это заглушка Finik для разработки.</p></main></body></html>`;
}
