import type { AdminMedia, AdminVideo, FileRef, ImageRef, VideoRef } from '@bom/shared';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';

// Maps Media / Video rows to the public refs of docs/API.md. Anything not processed yet maps to null.

export const imageMediaSelect = {
  id: true,
  kind: true,
  status: true,
  width: true,
  height: true,
  blurDataUrl: true,
  variants: true,
} satisfies Prisma.MediaSelect;
export type ImageMediaRow = Prisma.MediaGetPayload<{ select: typeof imageMediaSelect }>;

export const fileMediaSelect = {
  id: true,
  kind: true,
  status: true,
  key: true,
  originalName: true,
  bytes: true,
} satisfies Prisma.MediaSelect;
export type FileMediaRow = Prisma.MediaGetPayload<{ select: typeof fileMediaSelect }>;

export const videoSelect = {
  id: true,
  status: true,
  durationSec: true,
  width: true,
  height: true,
  thumbnailUrl: true,
  hlsUrl: true,
  mp4Url: true,
} satisfies Prisma.VideoSelect;
export type VideoRow = Prisma.VideoGetPayload<{ select: typeof videoSelect }>;

const variantsSchema = z.object({ widths: z.array(z.number().int()) });

export function toImageRef(media: ImageMediaRow | null | undefined, alt: string): ImageRef | null {
  if (!media || media.kind !== 'image' || media.status !== 'ready' || !media.width || !media.height)
    return null;
  const variants = variantsSchema.safeParse(media.variants);
  if (!variants.success || variants.data.widths.length === 0) return null;
  return {
    id: media.id,
    width: media.width,
    height: media.height,
    alt,
    blurDataUrl: media.blurDataUrl,
    widths: variants.data.widths,
  };
}

export function toFileRef(media: FileMediaRow | null | undefined, mediaPublicUrl: string): FileRef | null {
  if (!media || media.kind !== 'pdf' || media.status !== 'ready' || !media.key) return null;
  return {
    url: `${mediaPublicUrl}/${media.key}`,
    name: media.originalName ?? 'file.pdf',
    bytes: media.bytes,
  };
}

export function toVideoRef(video: VideoRow | null | undefined): VideoRef | null {
  if (!video || video.status !== 'ready') return null;
  return {
    id: video.id,
    durationSec: video.durationSec,
    width: video.width,
    height: video.height,
    poster: video.thumbnailUrl,
    hls: video.hlsUrl,
    mp4: video.mp4Url,
  };
}

export const adminMediaSelect = { ...imageMediaSelect, ...fileMediaSelect } satisfies Prisma.MediaSelect;
export type AdminMediaRow = Prisma.MediaGetPayload<{ select: typeof adminMediaSelect }>;

/** Media as the admin sees it: status plus a preview once processed. */
export function toAdminMedia(media: AdminMediaRow, mediaPublicUrl: string): AdminMedia {
  return {
    id: media.id,
    status: media.status,
    image: toImageRef(media, media.originalName ?? ''),
    file: toFileRef(media, mediaPublicUrl),
  };
}

export const adminVideoSelect = {
  id: true,
  status: true,
  title: true,
  durationSec: true,
  thumbnailUrl: true,
  hlsUrl: true,
  mp4Url: true,
  bytes: true,
  createdAt: true,
} satisfies Prisma.VideoSelect;
export type AdminVideoRow = Prisma.VideoGetPayload<{ select: typeof adminVideoSelect }>;

export function toAdminVideo(video: AdminVideoRow): AdminVideo {
  return { ...video, createdAt: video.createdAt.toISOString() };
}
