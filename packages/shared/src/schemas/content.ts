import { z } from '../zod';
import { WHOLESALE_COUNTRIES } from '../enums';
import { productCardSchema } from './catalog';
import { fileRefSchema, imageRefSchema, videoRefSchema } from './common';

// Owner-editable content blocks (docs/DATA-MODEL.md §4). Fields added after launch use `.default()` so stored rows
// written before them still parse. In titles, `*word*` marks the accent word
// (italic, accent colour), as in the design's "Время *расцвета* и сияния вашей кожи".

const text = (max = 500) => z.string().trim().max(max);
const titledText = z.object({ title: text(120), text: text(400) });
const stat = z.object({ value: text(40), label: text(120) });
const comparisonSide = z.object({ eyebrow: text(60), title: text(80), points: z.array(text(120)).max(5) });

export const homeContentSchema = z.object({
  heroBadge: text(80),
  heroTitle: text(160),
  heroSubtitle: text(200),
  quizPrompt: text(200),
  /** Нурайым's photo in the hero; tapping it plays the greeting video when there is one. */
  heroPhotoMediaId: z.uuid().nullable().default(null),
  greetingVideoId: z.uuid().nullable(),
  entries: z
    .array(
      titledText.extend({
        key: z.enum(['programs', 'catalog', 'wholesale']),
        imageMediaId: z.uuid().nullable(),
      }),
    )
    .length(3),
  comparison: z.object({ title: text(120), subtitle: text(200), mass: comparisonSide, pro: comparisonSide }),
  about: z.object({
    caption: text(80),
    text: text(1500),
    stats: z.array(stat).max(4),
    photoMediaId: z.uuid().nullable().default(null),
  }),
  reviewsTitle: text(80),
  reviewsSubtitle: text(200),
});

export const wholesaleContentSchema = z.object({
  /** Phone for calls; empty until Нурайым confirms the number. */
  phone: text(40),
  /** Overrides the shop WhatsApp for price requests when set. */
  whatsapp: text(40).nullable(),
  eyebrow: text(120),
  title: text(200),
  subtitle: text(300),
  facts: z.array(text(60)).max(3),
  quote: text(400),
  intro: z.array(text(800)).max(4),
  stats: z.array(stat).max(4),
  expertise: z.array(text(60)).max(6),
  featuredProductIds: z.array(z.uuid()).max(20),
  benefits: z.array(titledText).max(4),
  steps: z.array(titledText).max(4),
  stockNote: text(200),
  delivery: z
    .array(
      z.object({
        region: text(120),
        flags: z.array(z.enum(WHOLESALE_COUNTRIES)),
        airDays: text(20),
        seaDays: text(20),
      }),
    )
    .max(6),
  catalogMediaId: z.uuid().nullable(),
  /** Portrait in the "Обо мне" block, shown until a video is uploaded. */
  portraitMediaId: z.uuid().nullable().default(null),
  videoId: z.uuid().nullable(),
});

export const deliveryContentSchema = z.object({
  /** Rows under the program price ("Доставка по Бишкеку" · "в день оплаты"). */
  programFacts: z.array(z.object({ label: text(80), value: text(80) })).max(5),
  markdown: text(20000),
  faq: z.array(z.object({ q: text(300), a: text(3000) })).max(40),
});

export const markdownContentSchema = z.object({ markdown: text(100000) });

export const CONTENT_SCHEMAS = {
  home: homeContentSchema,
  wholesale: wholesaleContentSchema,
  delivery: deliveryContentSchema,
  privacy: markdownContentSchema,
  offer: markdownContentSchema,
} as const;
export type ContentKey = keyof typeof CONTENT_SCHEMAS;
export type ContentValue<K extends ContentKey> = z.infer<(typeof CONTENT_SCHEMAS)[K]>;
export const CONTENT_KEYS = Object.keys(CONTENT_SCHEMAS) as ContentKey[];

/** GET /content/:key. `data` matches CONTENT_SCHEMAS[key]; `refs` resolves the ids it mentions. */
export const contentResponseSchema = z.object({
  key: z.enum(['home', 'wholesale', 'delivery', 'privacy', 'offer']),
  data: z.record(z.string(), z.unknown()),
  refs: z.object({
    images: z.record(z.string(), imageRefSchema),
    videos: z.record(z.string(), videoRefSchema),
    files: z.record(z.string(), fileRefSchema),
    products: z.array(productCardSchema),
  }),
  updatedAt: z.iso.datetime(),
});
export type ContentResponse = z.infer<typeof contentResponseSchema>;
