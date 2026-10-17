import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  IMAGE_MAX_BYTES,
  PDF_MAX_BYTES,
  purposeKind,
  type AdminMedia,
  type PresignMediaInput,
  type PresignMediaResponse,
} from '@bom/shared';
import { ApiException, notFound } from '../common/errors';
import { adminMediaSelect, toAdminMedia } from '../common/media-refs';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const UPLOAD_WINDOW_MS = 60 * 60_000;

/** Admin uploads (docs/ARCHITECTURE.md §7.5): presign → browser POST to S3 → complete → `media.process`. */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async presign(input: PresignMediaInput, userId: string): Promise<PresignMediaResponse> {
    const kind = purposeKind(input.purpose);
    const expiresAt = new Date(Date.now() + UPLOAD_WINDOW_MS);
    const media = await this.prisma.media.create({
      data: {
        bucket: 'private',
        kind,
        status: 'pending',
        mime: input.contentType,
        originalName: input.fileName,
        bytes: input.size,
        uploadedById: userId,
        expiresAt,
      },
      select: { id: true },
    });
    const key = `incoming/${media.id}`;
    await this.prisma.media.update({ where: { id: media.id }, data: { key } });
    const upload = await this.storage.presignUpload(
      key,
      input.contentType,
      kind === 'pdf' ? PDF_MAX_BYTES : IMAGE_MAX_BYTES,
    );
    return { mediaId: media.id, upload, expiresAt: expiresAt.toISOString() };
  }

  /** The browser finished uploading: check the object and queue processing. */
  async complete(id: string): Promise<AdminMedia> {
    const media = await this.prisma.media.findUnique({
      where: { id },
      select: { status: true, key: true, kind: true },
    });
    if (!media?.key) throw notFound('Файл не найден');
    if (media.status === 'pending') {
      const object = await this.storage.head('private', media.key);
      if (!object) {
        throw new ApiException('validation_failed', HttpStatus.BAD_REQUEST, 'Файл не загрузился', {
          id: 'media.not_uploaded',
        });
      }
      await this.prisma.media.update({ where: { id }, data: { status: 'processing', bytes: object.bytes } });
      await this.jobs.add('media.process', { mediaId: id }, { jobId: `media-${id}` });
    }
    return this.get(id);
  }

  async get(id: string): Promise<AdminMedia> {
    const media = await this.prisma.media.findUnique({ where: { id }, select: adminMediaSelect });
    if (!media) throw notFound('Файл не найден');
    return toAdminMedia(media, this.env.MEDIA_PUBLIC_URL);
  }
}
