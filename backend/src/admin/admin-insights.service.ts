import { Injectable } from '@nestjs/common';
import {
  addDays,
  bishkekDayStart,
  utmSchema,
  type Customer,
  type Dashboard,
  type DashboardPeriod,
  type LeadList,
  type LeadListQuery,
} from '@bom/shared';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { orderLinesInclude, toOrderRow } from './admin-orders.service';

const answersSchema = z.record(z.string(), z.unknown());

/** Leads, customers and the overview (docs/API.md §6). Cancelled orders never count as sales. */
@Injectable()
export class AdminInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async leads(query: LeadListQuery & { limit: number }): Promise<LeadList> {
    const [rows, groups] = await Promise.all([
      this.prisma.lead.findMany({
        where: query.kind ? { kind: query.kind } : {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.lead.groupBy({ by: ['kind'], _count: { _all: true } }),
    ]);
    const page = rows.slice(0, query.limit);
    const slugs = [...new Set(page.flatMap((lead) => lead.recommended))];
    const programs = slugs.length
      ? await this.prisma.program.findMany({
          where: { slug: { in: slugs } },
          select: { slug: true, title: true },
        })
      : [];
    const count = (kind: 'quiz' | 'wholesale') => groups.find((g) => g.kind === kind)?._count._all ?? 0;
    return {
      items: page.map((lead) => {
        const answers = answersSchema.safeParse(lead.answers);
        const utm = utmSchema.safeParse(lead.utm);
        return {
          id: lead.id,
          kind: lead.kind,
          answers: answers.success
            ? Object.fromEntries(
                Object.entries(answers.data).filter(
                  (entry): entry is [string, string] => typeof entry[1] === 'string',
                ),
              )
            : {},
          recommended: lead.recommended.map((slug) => ({
            slug,
            title: programs.find((program) => program.slug === slug)?.title ?? slug,
          })),
          choose: lead.choose,
          message: lead.message,
          pageUrl: lead.pageUrl,
          utm: lead.utm && utm.success ? utm.data : null,
          createdAt: lead.createdAt.toISOString(),
        };
      }),
      nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
      counts: { all: count('quiz') + count('wholesale'), quiz: count('quiz'), wholesale: count('wholesale') },
    };
  }

  /** One row per phone number, biggest spenders first (design: custRows). */
  async customers(q?: string): Promise<Customer[]> {
    const text = q?.trim();
    const digits = text?.replace(/\D/g, '') ?? '';
    const filter = text
      ? Prisma.sql`HAVING bool_or(name ILIKE ${`%${text}%`})${
          digits.length >= 3 ? Prisma.sql` OR phone LIKE ${`%${digits}%`}` : Prisma.empty
        }`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      {
        phone: string;
        name: string;
        address: string;
        count: bigint;
        total: bigint;
        last: Date;
        favorite: string;
      }[]
    >`
      SELECT phone,
             (array_agg(name ORDER BY created_at DESC))[1] AS name,
             (array_agg(address ORDER BY created_at DESC))[1] AS address,
             count(*) AS count,
             sum(total_kgs) AS total,
             max(created_at) AS last,
             (SELECT mode() WITHIN GROUP (ORDER BY l.title)
                FROM order_lines l
                JOIN orders o ON o.id = l.order_id
               WHERE o.phone = orders.phone AND o.status <> 'cancelled') AS favorite
      FROM orders
      WHERE status <> 'cancelled'
      GROUP BY phone
      ${filter}
      ORDER BY total DESC, last DESC
      LIMIT 500`;
    return rows.map((row) => ({
      name: row.name,
      phone: row.phone,
      city: (row.address.split(',')[0] ?? '').trim(),
      count: Number(row.count),
      totalKgs: Number(row.total),
      lastOrderAt: row.last.toISOString(),
      favorite: row.favorite,
    }));
  }

  async dashboard(period: DashboardPeriod, now = new Date()): Promise<Dashboard> {
    const todayStart = bishkekDayStart(now);
    const start = period === 'today' ? todayStart : addDays(now, period === 'week' ? -7 : -30);
    const previousStart =
      period === 'today' ? addDays(todayStart, -1) : addDays(start, period === 'week' ? -7 : -30);
    const weekAgo = addDays(now, -7);
    const inPeriod = { createdAt: { gte: start, lte: now } };

    const [orders, previousOrders, awaiting, sales, cancelled, cancelledWeek, recent, programGroups] =
      await Promise.all([
        this.prisma.order.count({ where: inPeriod }),
        this.prisma.order.count({ where: { createdAt: { gte: previousStart, lt: start } } }),
        this.prisma.order.count({ where: { status: 'new' } }),
        this.prisma.order.aggregate({
          where: { ...inPeriod, status: { not: 'cancelled' } },
          _sum: { totalKgs: true },
          _count: { _all: true },
        }),
        this.prisma.order.count({ where: { ...inPeriod, status: 'cancelled' } }),
        this.prisma.order.count({ where: { createdAt: { gte: weekAgo }, status: 'cancelled' } }),
        this.prisma.order.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: orderLinesInclude,
          take: 6,
        }),
        this.prisma.orderLine.groupBy({
          by: ['programId'],
          where: {
            type: 'program',
            order: { createdAt: { gte: weekAgo }, status: { not: 'cancelled' } },
          },
          _count: { _all: true },
        }),
      ]);

    const programIds = programGroups.map((g) => g.programId).filter((id): id is string => id !== null);
    const programs = programIds.length
      ? await this.prisma.program.findMany({
          where: { id: { in: programIds } },
          select: { id: true, title: true },
        })
      : [];
    const byProgram = programGroups
      .filter((group) => group.programId !== null)
      .map((group) => ({
        title: programs.find((program) => program.id === group.programId)?.title ?? '—',
        count: group._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'ru'));

    const sumKgs = sales._sum.totalKgs ?? 0;
    return {
      period,
      cards: {
        orders,
        previousOrders,
        awaiting,
        sumKgs,
        avgKgs: sales._count._all ? Math.round(sumKgs / sales._count._all) : 0,
        cancelled,
        cancelledWeek,
      },
      recent: recent.map(toOrderRow),
      byProgram,
      programOrdersTotal: byProgram.reduce((total, row) => total + row.count, 0),
    };
  }
}
