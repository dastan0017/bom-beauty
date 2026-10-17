import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalizePhone, type CreateOrder, type CreateOrderResponse } from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { hashIp } from '../common/client-ip';
import { ApiException, invalidField } from '../common/errors';
import { fakeId, isBot, isDuplicateClientRef, utmJson } from '../common/submission';
import { NotificationsService } from '../notifications/notifications.service';
import { TurnstileService } from '../common/turnstile.service';
import { PrismaService } from '../prisma/prisma.service';

interface RequestMeta {
  ip: string;
  userAgent?: string;
}

const NOT_AVAILABLE = 'Этой позиции больше нет на сайте';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly notifications: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(input: CreateOrder, meta: RequestMeta): Promise<CreateOrderResponse> {
    if (isBot(input.website)) return { id: fakeId(), number: 0 };

    const existing = await this.findByClientRef(input.clientRef);
    if (existing) return existing;

    await this.turnstile.assertHuman(input.turnstileToken, meta.ip);

    const phone = normalizePhone(input.phone);
    if (!phone) throw invalidField('phone', 'phone.invalid');

    // Prices always come from the database, never from the client.
    const item =
      input.item.type === 'product'
        ? await this.prisma.product.findFirst({
            where: { slug: input.item.slug, published: true },
            select: { id: true, name: true, priceKgs: true },
          })
        : await this.prisma.program.findFirst({
            where: { slug: input.item.slug, published: true },
            select: { id: true, title: true, priceKgs: true },
          });
    if (!item) throw new ApiException('not_found', HttpStatus.NOT_FOUND, NOT_AVAILABLE);
    const title = 'name' in item ? item.name : item.title;

    try {
      const order = await this.prisma.order.create({
        data: {
          itemType: input.item.type,
          ...(input.item.type === 'product' ? { productId: item.id } : { programId: item.id }),
          itemTitle: title,
          unitPriceKgs: item.priceKgs,
          qty: input.qty,
          totalKgs: item.priceKgs * input.qty,
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
        },
        select: { id: true, number: true },
      });
      await this.notifications.enqueue({ entity: 'order', id: order.id }).catch(() => undefined);
      return order;
    } catch (error) {
      // Two retries of the same submission raced; return the one that won.
      if (isDuplicateClientRef(error)) {
        const winner = await this.findByClientRef(input.clientRef);
        if (winner) return winner;
      }
      throw error;
    }
  }

  private findByClientRef(clientRef: string): Promise<CreateOrderResponse | null> {
    return this.prisma.order.findUnique({ where: { clientRef }, select: { id: true, number: true } });
  }
}
