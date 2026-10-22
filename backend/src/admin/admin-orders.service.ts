import { Injectable } from '@nestjs/common';
import {
  addDays,
  bishkekDateStart,
  bishkekDateTime,
  cityOf,
  orderKindLabel,
  orderLineLabel,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  utmSchema,
  type OrderCounters,
  type OrderDetail,
  type OrderList,
  type OrderListQuery,
  type OrderRow,
  type OrderStatus,
  type UpdateOrder,
} from '@bom/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { notFound } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const statusSchema = z.enum(ORDER_STATUSES);

/** Lines of an order, for every query that returns order rows. */
export const orderLinesInclude = {
  lines: {
    orderBy: { position: 'asc' },
    select: { type: true, title: true, unitPriceKgs: true, qty: true, totalKgs: true },
  },
} satisfies Prisma.OrderInclude;
type OrderWithLines = Prisma.OrderGetPayload<{ include: typeof orderLinesInclude }>;

export function toOrderRow(order: OrderWithLines): OrderRow {
  return {
    id: order.id,
    number: order.number,
    name: order.name,
    phone: order.phone,
    lines: order.lines,
    address: order.address,
    city: cityOf(order.address),
    totalKgs: order.totalKgs,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}

/** Filters shared by the list and the CSV export. */
export function orderWhere(
  query: Pick<OrderListQuery, 'status' | 'q' | 'from' | 'to'>,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: bishkekDateStart(query.from) } : {}),
      ...(query.to ? { lt: addDays(bishkekDateStart(query.to), 1) } : {}),
    };
  }
  const q = query.q?.trim();
  if (q) {
    const or: Prisma.OrderWhereInput[] = [
      { name: { contains: q, mode: 'insensitive' } },
      { lines: { some: { title: { contains: q, mode: 'insensitive' } } } },
      { address: { contains: q, mode: 'insensitive' } },
    ];
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ phone: { contains: digits } });
    if (/^#?\d{1,9}$/.test(q)) or.push({ number: Number(digits) });
    where.OR = or;
  }
  return where;
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: OrderListQuery & { limit: number }): Promise<OrderList> {
    const rows = await this.prisma.order.findMany({
      where: orderWhere(query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: orderLinesInclude,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toOrderRow),
      nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async counters(): Promise<OrderCounters> {
    const groups = await this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    const count = (status: OrderStatus) => groups.find((g) => g.status === status)?._count._all ?? 0;
    const counters = { new: count('new'), sent: count('sent'), cancelled: count('cancelled') };
    return { all: counters.new + counters.sent + counters.cancelled, ...counters };
  }

  async detail(id: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderLinesInclude });
    if (!order) throw notFound('Заказ не найден');
    const logs = await this.prisma.auditLog.findMany({
      where: { entity: 'order', entityId: id },
      orderBy: { createdAt: 'asc' },
    });
    const userIds = [...new Set(logs.map((log) => log.userId).filter((v): v is string => v !== null))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const utm = utmSchema.safeParse(order.utm);
    return {
      ...toOrderRow(order),
      comment: order.comment,
      message: order.message,
      note: order.note,
      displayCurrency: order.displayCurrency,
      displayRate: order.displayRate,
      fromQuiz: order.fromQuiz,
      pageUrl: order.pageUrl,
      referrer: order.referrer,
      utm: order.utm && utm.success ? utm.data : null,
      statusChangedAt: order.statusChangedAt.toISOString(),
      history: logs.map((log) => {
        const diff = z
          .object({ from: statusSchema.optional(), to: statusSchema.optional() })
          .safeParse(log.diff);
        return {
          at: log.createdAt.toISOString(),
          action: log.action,
          from: diff.success ? (diff.data.from ?? null) : null,
          to: diff.success ? (diff.data.to ?? null) : null,
          userName: users.find((user) => user.id === log.userId)?.name ?? null,
        };
      }),
    };
  }

  async update(
    id: string,
    change: UpdateOrder,
    actor: { userId: string; ip: string | null },
  ): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { status: true, note: true } });
    if (!order) throw notFound('Заказ не найден');
    const statusChanged = change.status !== undefined && change.status !== order.status;
    const noteChanged = change.note !== undefined && change.note !== order.note;
    if (statusChanged || noteChanged) {
      await this.prisma.order.update({
        where: { id },
        data: {
          ...(statusChanged ? { status: change.status, statusChangedAt: new Date() } : {}),
          ...(noteChanged ? { note: change.note } : {}),
        },
      });
    }
    if (statusChanged) {
      await this.audit.log({
        userId: actor.userId,
        entity: 'order',
        entityId: id,
        action: 'status',
        diff: { from: order.status, to: change.status ?? order.status },
        ip: actor.ip,
      });
    }
    // The note text stays out of the log: it may hold personal details.
    if (noteChanged) {
      await this.audit.log({
        userId: actor.userId,
        entity: 'order',
        entityId: id,
        action: 'note',
        ip: actor.ip,
      });
    }
    return this.detail(id);
  }

  /** Deletion on the customer's request: the row goes, the log keeps only the number. */
  async remove(id: string, actor: { userId: string; ip: string | null }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { number: true } });
    if (!order) throw notFound('Заказ не найден');
    await this.prisma.order.delete({ where: { id } });
    await this.audit.log({
      userId: actor.userId,
      entity: 'order',
      entityId: id,
      action: 'delete',
      diff: { number: order.number },
      ip: actor.ip,
    });
  }

  /** CSV for Excel: UTF-8 BOM, ";" separator, Asia/Bishkek times (docs/API.md §6). */
  async exportCsv(query: Pick<OrderListQuery, 'status' | 'q' | 'from' | 'to'>): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: orderWhere(query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: orderLinesInclude,
      take: 50_000,
    });
    const header = [
      'Номер',
      'Дата',
      'Статус',
      'Клиент',
      'Телефон',
      'Город',
      'Адрес',
      'Тип',
      'Заказ',
      'Кол-во',
      'Цена, сом',
      'Сумма, сом',
      'Комментарий',
      'Заметка',
      'Из теста',
      'UTM source',
      'UTM campaign',
    ];
    const lines = orders.map((order) => {
      const utm = utmSchema.safeParse(order.utm);
      return [
        order.number,
        bishkekDateTime(order.createdAt),
        ORDER_STATUS_LABELS[order.status],
        order.name,
        order.phone,
        cityOf(order.address),
        order.address,
        orderKindLabel(order.lines),
        order.lines.map(orderLineLabel).join(', '),
        order.lines.reduce((sum, line) => sum + line.qty, 0),
        // A unit price only makes sense for one line.
        order.lines.length === 1 ? (order.lines[0]?.unitPriceKgs ?? '') : '',
        order.totalKgs,
        order.comment ?? '',
        order.note,
        order.fromQuiz ? 'да' : '',
        utm.success ? (utm.data.source ?? '') : '',
        utm.success ? (utm.data.campaign ?? '') : '',
      ];
    });
    return `\uFEFF${[header, ...lines].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
  }
}

/** Quotes a cell when needed and defuses spreadsheet formulas (=, +, -, @ at the start). */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
