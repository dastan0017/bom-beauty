import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  CONTENT_SCHEMAS,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  type AdminMedia,
  type AdminUser,
  type AdminVideo,
  type ContentKey,
  type ContentValue,
  type SettingKey,
  type UserRole,
} from '@bom/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { ApiException, notFound } from '../common/errors';
import { adminMediaSelect, adminVideoSelect, toAdminMedia, toAdminVideo } from '../common/media-refs';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { ContentService } from '../content/content.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RevalidateService, SITE_TAGS } from '../revalidate/revalidate.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import type { Actor } from '../admin-catalog/admin-products.service';

/** Settings a manager may change (docs/API.md §6); the rest are owner only. */
export const MANAGER_SETTINGS: readonly SettingKey[] = ['shop', 'appearance', 'currencies'];

/** Zod issues as the API's `fields` map (path → message code). */
function fieldErrors(error: z.ZodError, prefix: string): ApiException {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = [prefix, ...issue.path.map(String)].filter(Boolean).join('.');
    fields[path] ??= issue.message;
  }
  return new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Проверьте поля формы', fields);
}

/** Media, video and product ids a content block points at. */
function contentRefs(key: ContentKey, data: ContentValue<ContentKey>) {
  const media: string[] = [];
  const videos: string[] = [];
  const products: string[] = [];
  if (key === 'home') {
    const home = data as ContentValue<'home'>;
    if (home.catalogImageMediaId) media.push(home.catalogImageMediaId);
    if (home.heroPhotoMediaId) media.push(home.heroPhotoMediaId);
    if (home.about.photoMediaId) media.push(home.about.photoMediaId);
    if (home.greetingVideoId) videos.push(home.greetingVideoId);
  }
  if (key === 'wholesale') {
    const wholesale = data as ContentValue<'wholesale'>;
    if (wholesale.catalogMediaId) media.push(wholesale.catalogMediaId);
    if (wholesale.portraitMediaId) media.push(wholesale.portraitMediaId);
    if (wholesale.videoId) videos.push(wholesale.videoId);
    products.push(...wholesale.featuredProductIds);
  }
  return { media, videos, products };
}

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidator: RevalidateService,
    private readonly content: ContentService,
    private readonly settings: SettingsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Content blocks

  async getContent(key: ContentKey): Promise<{
    key: ContentKey;
    data: Record<string, unknown>;
    media: AdminMedia[];
    videos: AdminVideo[];
    updatedAt: string;
  }> {
    const row = await this.prisma.contentBlock.findUnique({ where: { key }, select: { updatedAt: true } });
    if (!row) throw notFound();
    const data = await this.content.get(key);
    const refs = contentRefs(key, data);
    const [media, videos] = await Promise.all([
      this.prisma.media.findMany({ where: { id: { in: refs.media } }, select: adminMediaSelect }),
      this.prisma.video.findMany({ where: { id: { in: refs.videos } }, select: adminVideoSelect }),
    ]);
    return {
      key,
      data: data,
      media: media.map((item) => toAdminMedia(item, this.env.MEDIA_PUBLIC_URL)),
      videos: videos.map(toAdminVideo),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async putContent(key: ContentKey, input: Record<string, unknown>, actor: Actor) {
    const parsed = CONTENT_SCHEMAS[key].safeParse(input);
    if (!parsed.success) throw fieldErrors(parsed.error, 'data');
    const data = parsed.data as ContentValue<ContentKey>;
    const refs = contentRefs(key, data);
    const [media, videos, products] = await Promise.all([
      this.prisma.media.count({ where: { id: { in: refs.media } } }),
      this.prisma.video.count({ where: { id: { in: refs.videos } } }),
      this.prisma.product.count({ where: { id: { in: refs.products } } }),
    ]);
    if (media !== new Set(refs.media).size || videos !== new Set(refs.videos).size) {
      throw new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Файл не найден', {
        data: 'media.not_found',
      });
    }
    if (products !== new Set(refs.products).size) {
      throw new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Товар не найден', {
        'data.featuredProductIds': 'product.not_found',
      });
    }
    await this.prisma.contentBlock.upsert({
      where: { key },
      create: { key, data: data as Prisma.InputJsonValue, updatedById: actor.userId },
      update: { data: data as Prisma.InputJsonValue, updatedById: actor.userId },
    });
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'content',
      entityId: key,
      action: 'update',
    });
    this.revalidator.revalidate([SITE_TAGS.content, SITE_TAGS.contentKey(key)]);
    return this.getContent(key);
  }

  // Settings

  async getSettings(role: UserRole): Promise<Record<string, Record<string, unknown>>> {
    const keys = role === 'owner' ? SETTING_KEYS : MANAGER_SETTINGS;
    const values = await Promise.all(keys.map(async (key) => [key, await this.settings.get(key)] as const));
    return Object.fromEntries(values);
  }

  async putSetting(key: SettingKey, input: Record<string, unknown>, actor: Actor & { role: UserRole }) {
    if (actor.role !== 'owner' && !MANAGER_SETTINGS.includes(key)) {
      throw new ApiException('forbidden', HttpStatus.FORBIDDEN, 'Это может сделать только владелец');
    }
    const parsed = SETTING_SCHEMAS[key].safeParse(input);
    if (!parsed.success) throw fieldErrors(parsed.error, 'value');
    if (key === 'seo') {
      const seo = parsed.data as z.infer<(typeof SETTING_SCHEMAS)['seo']>;
      if (
        seo.ogMediaId &&
        !(await this.prisma.media.count({ where: { id: seo.ogMediaId, kind: 'image' } }))
      ) {
        throw new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Файл не найден', {
          'value.ogMediaId': 'media.not_found',
        });
      }
    }
    if (key === 'notifications') {
      // A chat the bot cannot reach would lose every order message without a sound: refuse it on save.
      const n = parsed.data as z.infer<(typeof SETTING_SCHEMAS)['notifications']>;
      const problem =
        n.telegramEnabled && n.telegramChatId
          ? await this.notifications.telegramChatProblem(n.telegramChatId)
          : null;
      if (problem) {
        throw new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Бот не видит этот чат', {
          'value.telegramChatId': problem,
        });
      }
    }
    const value = parsed.data as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value, updatedById: actor.userId },
      update: { value, updatedById: actor.userId },
    });
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'setting',
      entityId: key,
      action: 'update',
    });
    // Theme, currencies, contacts and SEO texts are read by every page through the "settings" tag.
    this.revalidator.revalidate([SITE_TAGS.settings]);
    return this.settings.get(key) as Promise<Record<string, unknown>>;
  }

  // Users (owner)

  async listUsers(): Promise<AdminUser[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createUser(input: { email: string; name: string; role: UserRole; password: string }, actor: Actor) {
    if (await this.users.findByEmail(input.email)) {
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'Такая почта уже есть', {
        email: 'user.email.taken',
      });
    }
    const user = await this.users.create(input);
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'user',
      entityId: user.id,
      action: 'create',
      diff: { role: input.role },
    });
    return this.listUsers();
  }

  async updateUser(id: string, change: { name?: string; role?: UserRole; isActive?: boolean }, actor: Actor) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
    if (!user) throw notFound('Пользователь не найден');
    const losesOwner =
      user.role === 'owner' && ((change.role && change.role !== 'owner') || change.isActive === false);
    if (losesOwner) {
      if (id === actor.userId) {
        throw new ApiException('conflict', HttpStatus.CONFLICT, 'Нельзя снять права с себя', {
          id: 'user.self',
        });
      }
      const owners = await this.prisma.user.count({ where: { role: 'owner', isActive: true } });
      if (owners <= 1) {
        throw new ApiException('conflict', HttpStatus.CONFLICT, 'Нужен хотя бы один владелец', {
          id: 'user.last_owner',
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: change }),
      // A disabled user is signed out at once.
      ...(change.isActive === false ? [this.prisma.session.deleteMany({ where: { userId: id } })] : []),
    ]);
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'user',
      entityId: id,
      action: 'update',
      diff: change,
    });
    return this.listUsers();
  }

  async setPassword(id: string, password: string, actor: Actor): Promise<void> {
    if (!(await this.prisma.user.count({ where: { id } }))) throw notFound('Пользователь не найден');
    await this.users.setPassword(id, password);
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'user',
      entityId: id,
      action: 'password',
    });
  }

  /** "Выйти на всех устройствах": every session except the current one. */
  async revokeOtherSessions(currentSessionId: string, actor: Actor): Promise<{ revoked: number }> {
    const result = await this.prisma.session.deleteMany({ where: { id: { not: currentSessionId } } });
    await this.audit.log({
      userId: actor.userId,
      ip: actor.ip,
      entity: 'session',
      entityId: 'all',
      action: 'revoke',
      diff: { count: result.count },
    });
    return { revoked: result.count };
  }

  async auditLog(query: { entity?: string; cursor?: string; limit: number }) {
    const rows = await this.prisma.auditLog.findMany({
      where: query.entity ? { entity: query.entity } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    const userIds = [...new Set(page.map((row) => row.userId).filter((id): id is string => id !== null))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    return {
      items: page.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        userName: users.find((user) => user.id === row.userId)?.name ?? null,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        diff:
          row.diff && typeof row.diff === 'object' && !Array.isArray(row.diff)
            ? (row.diff as Record<string, unknown>)
            : {},
      })),
      nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}
