import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  buildOrderItemsText,
  formatKgs,
  PAYMENT_CHANNELS,
  renderWhatsappTemplate,
  type FinikStatus,
  type OrderItemType,
  type OrderPayment,
  type OrderPaymentStart,
  type PaymentAttempt,
  type PaymentChannel,
  type PaymentCheck,
  type PayPage,
  type PayStart,
} from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { ApiException, notFound } from '../common/errors';
import { isUniqueViolation } from '../common/submission';
import type { Prisma } from '../generated/prisma/client';
import type { NotifyTarget, PaymentReviewReason } from '../jobs/queues';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { FinikClient, type CreatePaymentResult } from './finik/finik.client';
import { FINIK_CONFIG, isFinikConfigured, maskAccountId, type FinikConfig } from './finik/finik.config';
import {
  finikWebhookSchema,
  verifyFinikWebhook,
  webhookAccount,
  webhookOutcome,
  webhookRecord,
  type FinikWebhook,
} from './finik/finik-webhook';
import { payPageUrl } from './pay-url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A live Finik link is reused only while it has at least this much time left. */
const REUSE_MARGIN_MS = 2 * 60_000;
/** After a link expires (or Finik refused it), this long before the order counts as unpaid. */
const GRACE_MS = 10 * 60_000;
/** Lifetime of the admin's 1 сом connection check. */
const CHECK_TTL_MS = 15 * 60_000;

const attemptSelect = {
  id: true,
  purpose: true,
  status: true,
  amountKgs: true,
  channel: true,
  createdAt: true,
  expiresAt: true,
  paidAt: true,
  paidAmountTyiyn: true,
  transactionId: true,
  receiptNumber: true,
  error: true,
} satisfies Prisma.PaymentSelect;
type AttemptRow = Prisma.PaymentGetPayload<{ select: typeof attemptSelect }>;

export interface PayableOrder {
  id: string;
  number: number;
  payToken: string;
  amountKgs: number;
}

/**
 * Online payment through Finik (docs/finik/SPEC.md): attempts, the order's payment page, the webhook, link expiry
 * and the admin's connection check. Only a verified webhook marks an order paid; amounts always come from the DB.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly finik: FinikClient,
    @Inject(FINIK_CONFIG) private readonly config: FinikConfig,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Configured on the server and switched on by the owner. */
  async available(): Promise<boolean> {
    return isFinikConfigured(this.config) && (await this.settings.get('payments')).finikEnabled;
  }

  async assertAvailable(): Promise<void> {
    if (!(await this.available())) {
      throw new ApiException('payment_unavailable', HttpStatus.CONFLICT, 'Онлайн-оплата сейчас недоступна');
    }
  }

  pageUrl(token: string): string {
    return payPageUrl(this.env.WEB_ORIGIN, token);
  }

  /** Where a new online order goes next (POST /orders): Finik's page, or ours when Finik did not answer. */
  async startForOrder(order: PayableOrder): Promise<OrderPaymentStart> {
    const attempt = await this.createAttempt(order);
    return { url: attempt.url, page: this.pageUrl(order.payToken) };
  }

  /** A repeated POST /orders: the live link if there is one, never a new Finik call. */
  async replayStart(order: PayableOrder): Promise<OrderPaymentStart> {
    const live = await this.liveAttempt(order.id, order.amountKgs);
    return { url: live?.paymentUrl ?? null, page: this.pageUrl(order.payToken) };
  }

  /**
   * A new attempt for the order's current amount. The row exists before Finik is called, so no webhook can arrive
   * for an unknown payment; a refused call leaves a `failed` attempt with the reason.
   */
  async createAttempt(order: PayableOrder): Promise<{ id: string; url: string | null }> {
    const environment = this.config.environment;
    if (!environment)
      throw new ApiException('payment_unavailable', HttpStatus.CONFLICT, 'Онлайн-оплата не настроена');
    const [payments, shop] = await Promise.all([this.settings.get('payments'), this.settings.get('shop')]);
    const expiresAt = new Date(Date.now() + payments.linkTtlMinutes * 60_000);
    const payment = await this.prisma.payment.create({
      data: { orderId: order.id, purpose: 'order', environment, amountKgs: order.amountKgs, expiresAt },
      select: { id: true },
    });
    const result = await this.finik.createPayment({
      paymentId: payment.id,
      amountKgs: order.amountKgs,
      description: `Заказ №${order.number}`,
      redirectUrl: `${this.pageUrl(order.payToken)}?from=finik`,
      expiresAt,
      qrName: shop.name,
    });
    if (result.ok) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'pending', paymentUrl: result.url },
      });
      await this.prisma.order.updateMany({
        where: { id: order.id, paymentStatus: { in: ['unpaid', 'pending'] } },
        data: { paymentStatus: 'pending' },
      });
      return { id: payment.id, url: result.url };
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', error: failureText(result) },
    });
    await this.prisma.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: 'pending',
        payments: { none: { status: 'pending', expiresAt: { gt: new Date() } } },
      },
      data: { paymentStatus: 'unpaid' },
    });
    return { id: payment.id, url: null };
  }

  /** `GET /pay/:token`: what the payment page shows. No personal data. */
  async page(token: string): Promise<PayPage> {
    const order = await this.prisma.order.findUnique({
      where: { payToken: token },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        paidAt: true,
        totalKgs: true,
        adjustmentKgs: true,
        adjustmentNote: true,
        lines: {
          orderBy: { position: 'asc' },
          select: { type: true, title: true, qty: true, totalKgs: true },
        },
      },
    });
    if (!order) throw notFound('Заказ не найден');
    const amountKgs = order.totalKgs + order.adjustmentKgs;
    const live = await this.liveAttempt(order.id, amountKgs);
    const status: PayPage['status'] =
      order.paymentStatus === 'paid'
        ? 'paid'
        : order.paymentStatus === 'refunded'
          ? 'refunded'
          : order.status === 'cancelled'
            ? 'cancelled'
            : live
              ? 'pending'
              : 'unpaid';
    const payable = status === 'unpaid' || status === 'pending';
    return {
      number: order.number,
      lines: order.lines,
      totalKgs: order.totalKgs,
      adjustmentKgs: order.adjustmentKgs,
      adjustmentNote: order.adjustmentNote,
      amountKgs,
      status,
      paidAt: order.paidAt?.toISOString() ?? null,
      canPay: payable && amountKgs > 0 && (await this.available()),
    };
  }

  /** `POST /pay/:token`: Finik's page for the current amount, reusing a live link when the amount is the same. */
  async start(token: string): Promise<PayStart> {
    await this.assertAvailable();
    const order = await this.prisma.order.findUnique({
      where: { payToken: token },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        totalKgs: true,
        adjustmentKgs: true,
        payToken: true,
      },
    });
    if (!order) throw notFound('Заказ не найден');
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'Заказ уже оплачен');
    }
    if (order.status === 'cancelled')
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'Заказ отменён');
    const amountKgs = order.totalKgs + order.adjustmentKgs;
    if (amountKgs < 1) throw new ApiException('conflict', HttpStatus.CONFLICT, 'Сумма к оплате не задана');

    const live = await this.liveAttempt(order.id, amountKgs);
    if (live?.paymentUrl) return { url: live.paymentUrl };
    const attempt = await this.createAttempt({ ...order, amountKgs });
    if (!attempt.url) {
      throw new ApiException(
        'payment_failed',
        HttpStatus.BAD_GATEWAY,
        'Не получилось открыть оплату, попробуйте ещё раз',
      );
    }
    return { url: attempt.url };
  }

  /**
   * `POST /webhooks/finik`. Verifies Finik's signature on the raw body, records the event once (Finik delivers at
   * least once), applies it in one locked transaction and only then notifies (docs/finik/SPEC.md §5.7).
   */
  async webhook(input: {
    rawBody: Buffer | undefined;
    headers: IncomingHttpHeaders;
    host: string | undefined;
    path: string;
  }): Promise<void> {
    const { webhookKey, webhookUrl } = this.config;
    if (!webhookKey || !webhookUrl) {
      throw new ApiException(
        'payment_unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Онлайн-оплата не настроена',
      );
    }
    const candidates = [{ host: webhookUrl.host, path: webhookUrl.pathname }];
    if (input.host && (input.host !== webhookUrl.host || input.path !== webhookUrl.pathname)) {
      candidates.push({ host: input.host, path: input.path });
    }
    const check = verifyFinikWebhook({
      rawBody: input.rawBody,
      headers: input.headers,
      candidates,
      publicKey: webhookKey,
      now: Date.now(),
    });
    if (!check.ok) {
      this.logger.warn(`webhook rejected: ${check.reason}`);
      throw check.status === 400
        ? new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Некорректный запрос')
        : new ApiException('unauthenticated', HttpStatus.UNAUTHORIZED, 'Подпись не прошла проверку');
    }

    const parsed = finikWebhookSchema.safeParse(check.body);
    const event: FinikWebhook = parsed.success ? parsed.data : {};
    const dedupeKey =
      event.id ??
      event.transactionId ??
      createHash('sha256')
        .update(input.rawBody ?? '')
        .digest('hex');
    if (await this.prisma.paymentEvent.findUnique({ where: { dedupeKey }, select: { id: true } })) return;

    let notices: NotifyTarget[];
    try {
      notices = await this.prisma.$transaction((tx) => this.apply(tx, event, dedupeKey));
    } catch (error) {
      if (isUniqueViolation(error)) return; // a concurrent delivery of the same event was recorded first
      throw error;
    }
    // The payment is stored; a notice that cannot be queued is logged, never undoes it.
    for (const notice of notices) {
      await this.notifications
        .enqueue(notice)
        .catch((error: unknown) => this.logger.error(`webhook notice not queued: ${String(error)}`));
    }
  }

  private async apply(
    tx: Prisma.TransactionClient,
    event: FinikWebhook,
    dedupeKey: string,
  ): Promise<NotifyTarget[]> {
    const kind = webhookOutcome(event.status);
    const record = (outcome: string, paymentId: string | null) =>
      tx.paymentEvent.create({
        data: { paymentId, dedupeKey, status: event.status ?? '', outcome, data: webhookRecord(event) },
        select: { id: true },
      });
    const paymentId = [event.fields?.paymentId, event.transactionId].find(
      (value): value is string => !!value && UUID.test(value),
    );
    const found = paymentId
      ? await tx.payment.findUnique({ where: { id: paymentId }, select: { id: true, orderId: true } })
      : null;
    // A valid signature only proves Finik sent it. The money must have gone to our account: Finik echoes the account
    // the payment was created for. Another merchant's payment carrying one of our PaymentIds is never applied.
    const account = webhookAccount(event);
    const ours = account !== undefined && account === this.config.accountId;

    if (!found) {
      if (account !== undefined && !ours) {
        await record('foreign_account', null);
        this.logger.warn(`webhook for another Finik account (status ${event.status ?? '-'})`);
        return [];
      }
      const stored = await record('unknown_payment', null);
      this.logger.warn(`webhook for an unknown payment (status ${event.status ?? '-'})`);
      // Money for our account that the site cannot match (say, after restoring an older backup): the owner checks it.
      return kind === 'paid' ? [{ entity: 'paymentEvent', id: stored.id, event: 'unknown' }] : [];
    }
    if (kind === 'other') {
      await record('ignored', found.id);
      this.logger.log(`webhook ${found.id}: status ${event.status ?? '-'} ignored`);
      return [];
    }
    if (!ours) {
      // One of our payments, but not paid into our account (or the account is missing): never applied automatically.
      await record(account === undefined ? 'unverified_account' : 'foreign_account', found.id);
      this.logger.warn(
        `webhook ${found.id}: Finik account ${account === undefined ? 'missing' : 'not ours'}`,
      );
      return kind === 'paid' ? [{ entity: 'payment', id: found.id, event: 'review', reason: 'account' }] : [];
    }

    // One delivery at a time per payment and per order: the second of two racing webhooks sees the first's result.
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${found.id}::uuid FOR UPDATE`;
    if (found.orderId) await tx.$queryRaw`SELECT id FROM orders WHERE id = ${found.orderId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: found.id },
      select: {
        id: true,
        status: true,
        amountKgs: true,
        purpose: true,
        order: {
          select: { id: true, status: true, paymentStatus: true, totalKgs: true, adjustmentKgs: true },
        },
      },
    });
    const review = (reason: PaymentReviewReason): NotifyTarget[] => [
      { entity: 'payment', id: payment.id, event: 'review', reason },
    ];

    if (kind === 'failed') {
      if (payment.status !== 'succeeded') {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'failed', error: 'finik: failed' },
        });
      }
      const order = payment.order;
      if (order?.paymentStatus === 'pending') {
        const live = await tx.payment.count({
          where: {
            orderId: order.id,
            id: { not: payment.id },
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
        });
        if (!live) await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'unpaid' } });
      }
      await record('failed', payment.id);
      return [];
    }

    // Paid. A second operation on a link that already succeeded is a second payment of the same money.
    if (payment.status === 'succeeded') {
      await record('duplicate_payment', payment.id);
      return review('double');
    }
    const paidAt = validDate(event.transactionDate) ?? new Date();
    const paidTyiyn = event.amount === undefined ? null : Math.round(event.amount * 100);
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        paidAt,
        paidAmountTyiyn: paidTyiyn,
        channel: event.service?.id?.toUpperCase() === 'VISA' ? 'visa' : 'qr',
        transactionId: event.transactionId ?? null,
        operationId: event.id ?? null,
        receiptNumber: event.receiptNumber ?? null,
      },
    });
    if (payment.purpose === 'check') {
      await record('check_paid', payment.id);
      return [{ entity: 'payment', id: payment.id, event: 'check_paid' }];
    }
    const order = payment.order;
    if (!order) {
      await record('paid_deleted', payment.id);
      return review('deleted');
    }
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
      await record('duplicate_payment', payment.id);
      return review('double');
    }
    // The money must match the link and what the order costs now: a link issued before an adjustment can still be
    // paid on Finik's side, and that must not settle the new amount.
    if (paidTyiyn !== payment.amountKgs * 100 || payment.amountKgs !== order.totalKgs + order.adjustmentKgs) {
      await record('amount_mismatch', payment.id);
      return review('amount');
    }
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'paid', paidAt } });
    await tx.auditLog.create({
      data: {
        userId: null,
        entity: 'order',
        entityId: order.id,
        action: 'payment',
        diff: { from: order.paymentStatus, to: 'paid', source: 'finik', paymentId: payment.id },
      },
    });
    if (order.status === 'cancelled') {
      await record('paid_cancelled', payment.id);
      return review('cancelled');
    }
    await record('applied', payment.id);
    return [{ entity: 'payment', id: payment.id, event: 'paid' }];
  }

  /**
   * Every 5 minutes: links past their end become `expired`; an online order with no live link left, unpaid, gets
   * one "не оплачен" message (if the owner wants it). A late webhook still pays such an order.
   */
  async expire(now = new Date()): Promise<{ expired: number; unpaid: number }> {
    const cutoff = new Date(now.getTime() - GRACE_MS);
    const { count: expired } = await this.prisma.payment.updateMany({
      where: { status: { in: ['created', 'pending'] }, expiresAt: { lt: cutoff } },
      data: { status: 'expired' },
    });
    const orders = await this.prisma.order.findMany({
      where: {
        paymentMethod: 'finik',
        paymentStatus: { in: ['pending', 'unpaid'] },
        unpaidNotifiedAt: null,
        status: { not: 'cancelled' },
        createdAt: { lt: cutoff },
        payments: {
          none: {
            OR: [{ status: { in: ['created', 'pending'] } }, { status: 'failed', updatedAt: { gt: cutoff } }],
          },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const { notifyUnpaid } = await this.settings.get('payments');
    let unpaid = 0;
    for (const order of orders) {
      const { count } = await this.prisma.order.updateMany({
        where: { id: order.id, unpaidNotifiedAt: null, paymentStatus: { in: ['pending', 'unpaid'] } },
        data: { paymentStatus: 'unpaid', unpaidNotifiedAt: now },
      });
      if (!count) continue;
      unpaid += 1;
      if (notifyUnpaid) {
        await this.notifications
          .enqueue({ entity: 'order', id: order.id, event: 'unpaid' })
          .catch((error: unknown) => this.logger.error(`unpaid notice not queued: ${String(error)}`));
      }
    }
    if (expired || unpaid)
      this.logger.log(`payments.expire: ${expired} links expired, ${unpaid} orders unpaid`);
    return { expired, unpaid };
  }

  /** «Проверить подключение»: a 1 сом payment without an order; paying it proves the webhook reaches us. */
  async startCheck(actor: { userId: string; ip: string | null }): Promise<PaymentCheck> {
    const environment = this.config.environment;
    if (!environment) throw new ApiException('payment_unavailable', HttpStatus.CONFLICT, 'Finik не настроен');
    const shop = await this.settings.get('shop');
    const expiresAt = new Date(Date.now() + CHECK_TTL_MS);
    const payment = await this.prisma.payment.create({
      data: { purpose: 'check', environment, amountKgs: 1, expiresAt },
      select: { id: true },
    });
    const result = await this.finik.createPayment({
      paymentId: payment.id,
      amountKgs: 1,
      description: 'Проверка подключения',
      redirectUrl: `${this.env.ADMIN_ORIGIN}/settings/payments?check=${payment.id}`,
      expiresAt,
      qrName: shop.name,
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: result.ok
        ? { status: 'pending', paymentUrl: result.url }
        : { status: 'failed', error: failureText(result) },
    });
    await this.audit.log({
      userId: actor.userId,
      entity: 'payment',
      entityId: payment.id,
      action: 'check',
      ip: actor.ip,
    });
    return this.checkStatus(payment.id);
  }

  async checkStatus(id: string): Promise<PaymentCheck> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, purpose: 'check' },
      select: { id: true, status: true, paymentUrl: true, error: true, paidAt: true },
    });
    if (!payment) throw notFound('Проверка не найдена');
    return {
      id: payment.id,
      status: payment.status,
      url: payment.status === 'pending' ? payment.paymentUrl : null,
      error: payment.error,
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }

  finikStatus(): FinikStatus {
    return {
      configured: isFinikConfigured(this.config),
      environment: this.config.environment,
      accountId: maskAccountId(this.config.accountId),
      webhookUrl: this.config.webhookUrl?.toString() ?? null,
    };
  }

  /** The admin drawer's «Оплата» section, with the link text ready for WhatsApp while online payment is on. */
  async orderPayment(order: {
    id: string;
    number: number;
    name: string;
    address: string;
    payToken: string;
    paymentMethod: OrderPayment['method'];
    paymentStatus: OrderPayment['status'];
    paidAt: Date | null;
    totalKgs: number;
    adjustmentKgs: number;
    adjustmentNote: string | null;
    lines: { type: OrderItemType; title: string; qty: number; totalKgs: number }[];
  }): Promise<OrderPayment> {
    const [attempts, on, payments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: attemptSelect,
      }),
      this.available(),
      this.settings.get('payments'),
    ]);
    const amountKgs = order.totalKgs + order.adjustmentKgs;
    const payUrl = on ? this.pageUrl(order.payToken) : null;
    return {
      method: order.paymentMethod,
      status: order.paymentStatus,
      paidAt: order.paidAt?.toISOString() ?? null,
      adjustmentKgs: order.adjustmentKgs,
      adjustmentNote: order.adjustmentNote,
      amountKgs,
      payUrl,
      linkMessage: payUrl
        ? renderWhatsappTemplate(payments.templates.link, {
            name: order.name,
            number: order.number,
            items: buildOrderItemsText(order),
            total: formatKgs(amountKgs),
            address: order.address,
            link: payUrl,
          })
        : null,
      attempts: attempts.map(toAttempt),
    };
  }

  private liveAttempt(orderId: string, amountKgs: number) {
    return this.prisma.payment.findFirst({
      where: {
        orderId,
        purpose: 'order',
        status: 'pending',
        amountKgs,
        paymentUrl: { not: null },
        expiresAt: { gt: new Date(Date.now() + REUSE_MARGIN_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, paymentUrl: true },
    });
  }
}

function toAttempt(row: AttemptRow): PaymentAttempt {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    amountKgs: row.amountKgs,
    channel: isChannel(row.channel) ? row.channel : null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    paidAmountKgs: row.paidAmountTyiyn === null ? null : row.paidAmountTyiyn / 100,
    transactionId: row.transactionId,
    receiptNumber: row.receiptNumber,
    error: row.error,
  };
}

const isChannel = (value: string | null): value is PaymentChannel =>
  (PAYMENT_CHANNELS as readonly string[]).includes(value ?? '');

function validDate(ms: number | undefined): Date | null {
  if (ms === undefined) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Short reason for the admin's attempt list: "Finik 403: Forbidden", "timeout". */
function failureText(result: CreatePaymentResult): string {
  if (result.ok) return '';
  if (result.reason === 'http') return `Finik ${result.status ?? ''}: ${result.message ?? ''}`.slice(0, 300);
  return result.reason;
}
