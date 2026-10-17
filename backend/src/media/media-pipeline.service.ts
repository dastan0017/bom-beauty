import { Injectable, Logger } from '@nestjs/common';
import { slugify } from '@bom/shared';
import decodeHeic from 'heic-decode';
import sharp, { type Sharp } from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Variant widths (docs/DATA-MODEL.md §6); never wider than the original. */
export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920] as const;
/** JPEG copy for share cards: next/og's renderer draws PNG and JPEG but not WebP or AVIF. */
export const SHARE_WIDTH = 1200;
const IMMUTABLE = 'public, max-age=31536000, immutable';

export function variantWidths(originalWidth: number): number[] {
  const largest = Math.min(originalWidth, VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1] ?? originalWidth);
  return [...VARIANT_WIDTHS.filter((width) => width < largest), largest];
}

/**
 * `media.process`: turns an upload in `incoming/` into served files.
 * Images: auto-rotate, metadata stripped (EXIF, GPS), AVIF + WebP variants, a JPEG share copy, 24 px blur, original
 * kept in `orig/`.
 * PDFs: magic-byte check, copied to the public bucket as a download.
 */
@Injectable()
export class MediaPipelineService {
  private readonly logger = new Logger(MediaPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async process(mediaId: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, kind: true, status: true, key: true, originalName: true },
    });
    if (!media || media.status === 'ready' || !media.key) return;
    await this.prisma.media.update({ where: { id: mediaId }, data: { status: 'processing', error: null } });
    try {
      const original = await this.storage.get('private', media.key);
      if (media.kind === 'image') await this.image(media.id, media.key, original);
      else await this.pdf(media.id, media.key, media.originalName, original);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`media ${mediaId} failed: ${message}`);
      await this.prisma.media.update({
        where: { id: mediaId },
        data: { status: 'failed', error: message.slice(0, 500) },
      });
      throw error;
    }
  }

  private async image(id: string, key: string, original: Buffer): Promise<void> {
    // Decode once to raw pixels, upright, without any metadata; every variant is encoded from that.
    const { data, info } = await (
      await this.decode(original)
    )
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = () =>
      sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
    const widths = variantWidths(info.width);

    for (const width of widths) {
      const resized = raw().resize({ width, withoutEnlargement: true });
      const [avif, webp] = await Promise.all([
        resized.clone().avif({ quality: 55, effort: 4 }).toBuffer(),
        resized.clone().webp({ quality: 78 }).toBuffer(),
      ]);
      await this.storage.put('public', `p/${id}/${width}.avif`, avif, {
        contentType: 'image/avif',
        cacheControl: IMMUTABLE,
      });
      await this.storage.put('public', `p/${id}/${width}.webp`, webp, {
        contentType: 'image/webp',
        cacheControl: IMMUTABLE,
      });
    }
    const share = await raw()
      .resize({ width: Math.min(info.width, SHARE_WIDTH) })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    await this.storage.put('public', `p/${id}/share.jpg`, share, {
      contentType: 'image/jpeg',
      cacheControl: IMMUTABLE,
    });
    const blur = await raw().resize({ width: 24 }).webp({ quality: 50 }).toBuffer();
    const origKey = `orig/${id}`;
    await this.storage.move({ bucket: 'private', key }, { bucket: 'private', key: origKey });

    await this.prisma.media.update({
      where: { id },
      data: {
        status: 'ready',
        bucket: 'private',
        key: origKey,
        width: info.width,
        height: info.height,
        bytes: original.length,
        blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
        variants: { widths },
        processedAt: new Date(),
        expiresAt: null,
      },
    });
  }

  /** sharp reads JPEG, PNG, WebP, AVIF; HEIC from iPhones goes through the WASM decoder. */
  private async decode(original: Buffer): Promise<Sharp> {
    const image = sharp(original, { failOn: 'error', limitInputPixels: 100_000_000 });
    try {
      const meta = await image.metadata();
      if (meta.format !== 'heif' || meta.compression === 'av1') return image;
      // HEVC-compressed HEIF: sharp's prebuilt libvips cannot decode it; fall through to the WASM decoder.
      await image.clone().resize(1).toBuffer();
      return image;
    } catch {
      const decoded = await decodeHeic({ buffer: original });
      return sharp(Buffer.from(decoded.data.buffer), {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
      });
    }
  }

  private async pdf(id: string, key: string, originalName: string | null, original: Buffer): Promise<void> {
    if (original.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Файл не похож на PDF');
    const name = (originalName ?? 'file.pdf').replace(/\.pdf$/i, '');
    const publicKey = `d/${id}/${slugify(name) || 'file'}.pdf`;
    await this.storage.put('public', publicKey, original, {
      contentType: 'application/pdf',
      cacheControl: IMMUTABLE,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`,
    });
    await this.storage.delete('private', key);
    await this.prisma.media.update({
      where: { id },
      data: {
        status: 'ready',
        bucket: 'public',
        key: publicKey,
        bytes: original.length,
        processedAt: new Date(),
        expiresAt: null,
      },
    });
  }
}
