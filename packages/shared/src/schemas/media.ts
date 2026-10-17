import { z } from 'zod';
import { adminVideoSchema } from './admin-catalog';

// Uploads (docs/ARCHITECTURE.md §7.5, §7.6). Limits are checked by the API and again by the storage policy.

export const MEDIA_PURPOSES = ['product', 'review', 'content', 'protocol', 'catalog', 'seo'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
] as const;
export const PDF_TYPES = ['application/pdf'] as const;
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/** PDFs for protocols and the brand catalog; images for everything else. */
export const purposeKind = (purpose: MediaPurpose): 'image' | 'pdf' =>
  purpose === 'protocol' || purpose === 'catalog' ? 'pdf' : 'image';

export const presignMediaSchema = z
  .object({
    purpose: z.enum(MEDIA_PURPOSES),
    contentType: z.string().trim().toLowerCase().max(100),
    size: z.number().int().min(1, 'media.empty'),
    fileName: z.string().trim().min(1).max(200),
  })
  .superRefine((value, ctx) => {
    const kind = purposeKind(value.purpose);
    const types: readonly string[] = kind === 'pdf' ? PDF_TYPES : IMAGE_TYPES;
    if (!types.includes(value.contentType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contentType'],
        message: kind === 'pdf' ? 'media.pdf_only' : 'media.image_only',
      });
    }
    if (value.size > (kind === 'pdf' ? PDF_MAX_BYTES : IMAGE_MAX_BYTES)) {
      ctx.addIssue({
        code: 'custom',
        path: ['size'],
        message: kind === 'pdf' ? 'media.pdf_too_big' : 'media.image_too_big',
      });
    }
  });
export type PresignMediaInput = z.infer<typeof presignMediaSchema>;

export const presignMediaResponseSchema = z.object({
  mediaId: z.uuid(),
  /** Browser form upload: POST `url` with `fields` and then the file as `file`. */
  upload: z.object({ url: z.string(), fields: z.record(z.string(), z.string()) }),
  expiresAt: z.iso.datetime(),
});
export type PresignMediaResponse = z.infer<typeof presignMediaResponseSchema>;

export const createVideoSchema = z.object({
  title: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(200),
  size: z.number().int().min(1, 'media.empty').max(VIDEO_MAX_BYTES, 'media.video_too_big'),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const createVideoResponseSchema = z.object({
  video: adminVideoSchema,
  /** Direct upload to Bunny Stream over TUS (signature valid for 2 hours). */
  tus: z.object({
    endpoint: z.string(),
    headers: z.object({
      AuthorizationSignature: z.string(),
      AuthorizationExpire: z.string(),
      VideoId: z.string(),
      LibraryId: z.string(),
    }),
  }),
});
export type CreateVideoResponse = z.infer<typeof createVideoResponseSchema>;

export const notificationTestResultSchema = z.object({
  telegram: z.enum(['sent', 'off', 'not_configured', 'failed']),
  email: z.enum(['sent', 'off', 'not_configured', 'failed']),
  error: z.string().nullable(),
});
export type NotificationTestResult = z.infer<typeof notificationTestResultSchema>;
