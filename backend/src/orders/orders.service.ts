import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalizePhone, orderLinesOf, type CreateOrder, type CreateOrderResponse } from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { hashIp } from '../common/client-ip';
import { ApiException, invalidField } from '../common/errors';
import { fakeId, isBot, isDuplicateClientRef, utmJson } from '../common/submission';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { TurnstileService } from '../common/turnstile.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RequestMeta {
  ip: string;
  userAgent?: string;
}

const NOT_AVAILABLE = 'Этой позиции больше нет на сайте';

const storedSelect = {
  id: true,
  number: true,
  payToken: true,
  paymentMethod: true,
  totalKgs: true,
  adjustmentKgs: true,
} satisfies Prisma.OrderSelect;
type StoredOrder = Prisma.OrderGetPayload<{ select: typeof storedSelect }>;

const payable = (order: StoredOrder) => ({
  id: order.id,
  number: order.number,
  payToken: order.payToken,
  amountKgs: order.totalKgs + order.adjustmentKgs,
});

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(input: CreateOrder, meta: RequestMeta): Promise<CreateOrderResponse> {
    if (isBot(input.website)) return { id: fakeId(), number: 0, payment: null };

    const existing = await this.findByClientRef(input.clientRef);
    if (existing) return this.response(existing);

    // Online payment must be on before anything is stored, so the site can fall back to WhatsApp cleanly.
    if (input.paymentMethod === 'finik') await this.payments.assertAvailable();
    await this.turnstile.assertHuman(input.turnstileToken, meta.ip);

    const phone = normalizePhone(input.phone);
    if (!phone) throw invalidField('phone', 'phone.invalid');

    // Prices always come from the database, never from the client.
    const requested = orderLinesOf(input);
    const slugsOf = (type: 'product' | 'program') =>
      requested.filter((line) => line.type === type).map((line) => line.slug);
    const [products, programs] = await Promise.all([
      this.prisma.product.findMany({
        where: { slug: { in: slugsOf('product') }, published: true },
        select: { id: true, slug: true, name: true, priceKgs: true },
      }),
      this.prisma.program.findMany({
        where: { slug: { in: slugsOf('program') }, published: true },
        select: { id: true, slug: true, title: true, priceKgs: true },
      }),
    ]);
    const lines = requested.map((line, position) => {
      const product = line.type === 'product' ? products.find((p) => p.slug === line.slug) : undefined;
      const program = line.type === 'program' ? programs.find((p) => p.slug === line.slug) : undefined;
      const found = product
        ? { productId: product.id, title: product.name, priceKgs: product.priceKgs }
        : program
          ? { programId: program.id, title: program.title, priceKgs: program.priceKgs }
          : null;
      if (!found) throw new ApiException('not_found', HttpStatus.NOT_FOUND, NOT_AVAILABLE);
      const { priceKgs, ...ref } = found;
      return {
        ...ref,
        position,
        type: line.type,
        unitPriceKgs: priceKgs,
        qty: line.qty,
        totalKgs: priceKgs * line.qty,
      };
    });

    let order: StoredOrder;
    try {
      order = await this.prisma.order.create({
        data: {
          lines: { create: lines },
          totalKgs: lines.reduce((sum, line) => sum + line.totalKgs, 0),
          name: input.name,
          phone,
          address: input.address,
          comment: input.comment || null,
          displayCurrency: input.displayCurrency,
          displayRate: input.displayCurrency === 'KGS' ? null : (input.displayRate ?? null),
          message: input.message,
          fromQuiz: input.fromQuiz ?? false,
          pageUrl: input.pageUrl,
          referrer: input.referrer ?? null,
          utm: utmJson(input.utm),
          clientRef: input.clientRef,
          ipHash: hashIp(meta.ip, this.env.IP_HASH_SALT),
          userAgent: meta.userAgent?.slice(0, 300) ?? null,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === 'finik' ? 'pending' : 'unpaid',
        },
        select: storedSelect,
      });
    } catch (error) {
      // Two retries of the same submission raced; return the one that won.
      if (isDuplicateClientRef(error)) {
        const winner = await this.findByClientRef(input.clientRef);
        if (winner) return this.response(winner);
      }
      throw error;
    }

    if (order.paymentMethod === 'finik') {
      // The owner hears about an online order once it is paid (or left unpaid), not now (docs/finik/SPEC.md §0).
      const payment = await this.payments.startForOrder(payable(order));
      return { id: order.id, number: order.number, payment };
    }
    await this.notifications.enqueue({ entity: 'order', id: order.id }).catch(() => undefined);
    return { id: order.id, number: order.number, payment: null };
  }

  /** A repeated submission: the same answer, with the live payment link if there is one (never a new one). */
  private async response(order: StoredOrder): Promise<CreateOrderResponse> {
    const payment = order.paymentMethod === 'finik' ? await this.payments.replayStart(payable(order)) : null;
    return { id: order.id, number: order.number, payment };
  }

  private findByClientRef(clientRef: string): Promise<StoredOrder | null> {
    return this.prisma.order.findUnique({ where: { clientRef }, select: storedSelect });
  }
}
