import { z } from '../zod';

// Building blocks shared by request and response schemas. Messages are codes; apps map them to texts in copy.ts.

export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug.invalid');

export const utmSchema = z.object({
  source: z.string().max(200).optional(),
  medium: z.string().max(200).optional(),
  campaign: z.string().max(200).optional(),
  content: z.string().max(200).optional(),
  term: z.string().max(200).optional(),
});
export type Utm = z.infer<typeof utmSchema>;

/** Fields every public form submission carries (orders and leads). */
export const submissionMetaShape = {
  /** Browser-generated idempotency key; a retry with the same key returns the original result. */
  clientRef: z.uuid('client_ref.invalid'),
  /** The exact text that was prefilled in WhatsApp. */
  message: z.string().max(2000),
  pageUrl: z.url().max(500),
  referrer: z.string().max(500).optional(),
  utm: utmSchema.optional(),
  /** Honeypot: humans never fill it. Non-empty submissions get a fake success and are dropped. */
  website: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
};

export const imageRefSchema = z.object({
  id: z.uuid(),
  width: z.number().int(),
  height: z.number().int(),
  alt: z.string(),
  blurDataUrl: z.string().nullable(),
  /** Pre-built variant widths; URLs are `${MEDIA_URL}/p/{id}/{width}.{avif|webp}`. */
  widths: z.array(z.number().int()),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

export const videoRefSchema = z.object({
  id: z.uuid(),
  durationSec: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  poster: z.string().nullable(),
  hls: z.string().nullable(),
  mp4: z.string().nullable(),
});
export type VideoRef = z.infer<typeof videoRefSchema>;

export const fileRefSchema = z.object({
  url: z.string(),
  name: z.string(),
  bytes: z.number().int().nullable(),
});
export type FileRef = z.infer<typeof fileRefSchema>;

export const ERROR_CODES = [
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'csrf_failed',
  'origin_mismatch',
  'not_found',
  'conflict',
  'too_large',
  'rate_limited',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    /** Field path → message code, for validation errors. */
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
