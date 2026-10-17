import { Inject, Injectable } from '@nestjs/common';
import type { AdminReview } from '@bom/shared';
import { AuditService } from '../audit/audit.service';
import { invalidField, notFound } from '../common/errors';
import { adminMediaSelect, toAdminMedia } from '../common/media-refs';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidateService, SITE_TAGS } from '../revalidate/revalidate.service';
import type { Actor } from './admin-products.service';

/** Review screenshots shown in the home carousel (design: isReviews). */
@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidator: RevalidateService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(): Promise<AdminReview[]> {
    const rows = await this.prisma.review.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        order: true,
        isHidden: true,
        isDemo: true,
        createdAt: true,
        media: { select: adminMediaSelect },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      order: row.order,
      isHidden: row.isHidden,
      isDemo: row.isDemo,
      media: toAdminMedia(row.media, this.env.MEDIA_PUBLIC_URL),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** New screenshots go to the end; the first real ones hide the demo examples (design: revDemoOn). */
  async create(mediaIds: string[], actor: Actor): Promise<AdminReview[]> {
    const unique = [...new Set(mediaIds)];
    const media = await this.prisma.media.count({
      where: { id: { in: unique }, kind: 'image', status: 'ready' },
    });
    if (media !== unique.length) throw invalidField('mediaIds', 'media.not_found');
    const taken = await this.prisma.review.count({ where: { mediaId: { in: unique } } });
    if (taken) throw invalidField('mediaIds', 'media.duplicate');
    // As in the design, fresh screenshots go first and the demo examples leave the site.
    await this.prisma.$transaction([
      this.prisma.review.updateMany({ data: { order: { increment: unique.length } } }),
      this.prisma.review.updateMany({ where: { isDemo: true }, data: { isHidden: true } }),
      this.prisma.review.createMany({ data: unique.map((mediaId, order) => ({ mediaId, order })) }),
    ]);
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'review',
      entityId: unique.join(','),
      action: 'create',
      diff: { count: unique.length },
    });
    this.revalidator.revalidate([SITE_TAGS.reviews]);
    return this.list();
  }

  async patch(id: string, isHidden: boolean, actor: Actor): Promise<AdminReview[]> {
    const updated = await this.prisma.review.updateMany({ where: { id }, data: { isHidden } });
    if (!updated.count) throw notFound('Отзыв не найден');
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'review',
      entityId: id,
      action: 'update',
      diff: { isHidden },
    });
    this.revalidator.revalidate([SITE_TAGS.reviews]);
    return this.list();
  }

  /** `ids` in the new order; reviews not listed keep their relative order after them. */
  async reorder(ids: string[], actor: Actor): Promise<AdminReview[]> {
    const rows = await this.prisma.review.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    const known = new Set(rows.map((row) => row.id));
    if (ids.some((id) => !known.has(id))) throw invalidField('ids', 'review.not_found');
    const listed = new Set(ids);
    const order = [...ids, ...rows.map((row) => row.id).filter((id) => !listed.has(id))];
    await this.prisma.$transaction(
      order.map((id, index) => this.prisma.review.update({ where: { id }, data: { order: index } })),
    );
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'review',
      entityId: 'order',
      action: 'reorder',
    });
    this.revalidator.revalidate([SITE_TAGS.reviews]);
    return this.list();
  }

  /** The screenshot file stays in storage; only unfinished uploads are cleaned up automatically. */
  async remove(id: string, actor: Actor): Promise<AdminReview[]> {
    const deleted = await this.prisma.review.deleteMany({ where: { id } });
    if (!deleted.count) throw notFound('Отзыв не найден');
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'review',
      entityId: id,
      action: 'delete',
    });
    this.revalidator.revalidate([SITE_TAGS.reviews]);
    return this.list();
  }
}
