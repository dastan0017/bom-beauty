import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminVideo, CreateVideoInput, CreateVideoResponse } from '@bom/shared';
import { ApiException, notFound } from '../common/errors';
import { adminVideoSelect, toAdminVideo } from '../common/media-refs';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import type { VideoStatus } from '../generated/prisma/client';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidateService, SITE_TAGS } from '../revalidate/revalidate.service';
import { BUNNY_STATUS, bunnyTusSignature, type BunnyVideo } from './bunny';

const API = 'https://video.bunnycdn.com';
const TUS_WINDOW_S = 2 * 3600;
/** `video.sync` polls every 30 s for up to an hour. */
const SYNC_DELAY_MS = 30_000;
const SYNC_MAX_ATTEMPTS = 120;

/** Bunny Stream videos (docs/ARCHITECTURE.md §7.6). Uploads go browser → Bunny over TUS, never through us. */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly revalidator: RevalidateService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private config() {
    const { BUNNY_LIBRARY_ID: libraryId, BUNNY_API_KEY: apiKey, BUNNY_CDN_HOST: cdnHost } = this.env;
    if (!libraryId || !apiKey || !cdnHost) {
      throw new ApiException('internal', HttpStatus.SERVICE_UNAVAILABLE, 'Видео пока не подключено', {
        video: 'video.not_configured',
      });
    }
    return { libraryId, apiKey, cdnHost };
  }

  private async bunny<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { apiKey } = this.config();
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        AccessKey: apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Bunny ${response.status} for ${path}`);
    return (await response.json()) as T;
  }

  async create(input: CreateVideoInput): Promise<CreateVideoResponse> {
    const { libraryId, apiKey } = this.config();
    const created = await this.bunny<{ guid: string }>(`/library/${libraryId}/videos`, {
      method: 'POST',
      body: JSON.stringify({ title: input.title }),
    });
    const video = await this.prisma.video.create({
      data: {
        libraryId,
        externalId: created.guid,
        status: 'uploading',
        title: input.title,
        originalName: input.fileName,
        bytes: input.size,
      },
      select: adminVideoSelect,
    });
    await this.jobs.add('video.sync', { videoId: video.id, attempt: 1 }, { delay: SYNC_DELAY_MS });
    const expires = Math.floor(Date.now() / 1000) + TUS_WINDOW_S;
    return {
      video: toAdminVideo(video),
      tus: {
        endpoint: `${API}/tusupload`,
        headers: {
          AuthorizationSignature: bunnyTusSignature(libraryId, apiKey, expires, created.guid),
          AuthorizationExpire: String(expires),
          VideoId: created.guid,
          LibraryId: libraryId,
        },
      },
    };
  }

  async get(id: string): Promise<AdminVideo> {
    const video = await this.prisma.video.findUnique({ where: { id }, select: adminVideoSelect });
    if (!video) throw notFound('Видео не найдено');
    return toAdminVideo(video);
  }

  /** 409 while a program, a product or a page uses it. */
  async remove(id: string): Promise<void> {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { externalId: true, libraryId: true },
    });
    if (!video) throw notFound('Видео не найдено');
    const programs = await this.prisma.program.count({ where: { videoId: id } });
    const products = await this.prisma.product.count({ where: { videoId: id } });
    const blocks = await this.prisma.contentBlock.findMany({ select: { data: true } });
    const inContent = blocks.some((block) => JSON.stringify(block.data).includes(id));
    if (programs || products || inContent) {
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'Видео используется на сайте', {
        id: 'video.in_use',
      });
    }
    await this.prisma.video.delete({ where: { id } });
    try {
      await this.bunny(`/library/${video.libraryId}/videos/${video.externalId}`, { method: 'DELETE' });
    } catch (error) {
      this.logger.warn(`Bunny delete failed for ${video.externalId}: ${String(error)}`);
    }
  }

  /** Webhook payloads are unsigned: they only trigger a status fetch. */
  async webhook(guid: string | undefined): Promise<void> {
    if (!guid) return;
    const video = await this.prisma.video.findUnique({ where: { externalId: guid }, select: { id: true } });
    if (video)
      await this.jobs.addSafely(
        'video.sync',
        { videoId: video.id, attempt: 0 },
        { jobId: `video-webhook-${video.id}-${Date.now()}` },
      );
  }

  /** `video.sync`: reads Bunny, stores status and URLs, re-schedules itself until finished or failed. */
  async sync(videoId: string, attempt: number): Promise<void> {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { externalId: true, libraryId: true, status: true },
    });
    if (!video || video.status === 'ready' || video.status === 'failed') return;
    const { cdnHost } = this.config();
    const remote = await this.bunny<BunnyVideo>(`/library/${video.libraryId}/videos/${video.externalId}`);
    const status = bunnyStatus(remote.status);
    const base = `https://${cdnHost}/${remote.guid}`;
    const resolutions = (remote.availableResolutions ?? '').split(',');
    await this.prisma.video.update({
      where: { id: videoId },
      data: {
        status,
        durationSec: remote.length ? Math.round(remote.length) : null,
        width: remote.width || null,
        height: remote.height || null,
        thumbnailUrl: remote.thumbnailFileName ? `${base}/${remote.thumbnailFileName}` : null,
        hlsUrl: status === 'ready' ? `${base}/playlist.m3u8` : null,
        mp4Url:
          status === 'ready' ? `${base}/play_${resolutions.includes('720p') ? '720p' : '480p'}.mp4` : null,
        error: status === 'failed' ? `Bunny status ${remote.status}` : null,
      },
    });
    if (status === 'ready') {
      this.revalidator.revalidate([SITE_TAGS.programs, SITE_TAGS.products, SITE_TAGS.content]);
      return;
    }
    if (status !== 'failed' && attempt > 0 && attempt < SYNC_MAX_ATTEMPTS) {
      await this.jobs.add('video.sync', { videoId, attempt: attempt + 1 }, { delay: SYNC_DELAY_MS });
    }
  }
}

function bunnyStatus(code: number): VideoStatus {
  if (code === BUNNY_STATUS.finished) return 'ready';
  if (code === BUNNY_STATUS.error || code === BUNNY_STATUS.uploadFailed) return 'failed';
  if (code === BUNNY_STATUS.created) return 'uploading';
  return 'processing';
}
