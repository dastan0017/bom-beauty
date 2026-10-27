import { z } from '../zod';
import { QUIZ_GOALS, SKIN_TYPES, USER_ROLES } from '../enums';
import { BADGES } from '../labels';
import { PRODUCT_IMAGES_MAX } from '../limits';
import { fileRefSchema, imageRefSchema, slugSchema } from './common';

// Admin catalog, content, settings and users (docs/API.md §6). Inputs use message codes; the admin maps them to text.

const text = (max: number) => z.string().trim().max(max, 'text.too_long');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'text.too_long')
    .nullable()
    .transform((value) => (value ? value : null));
const price = z
  .number({ error: 'price.required' })
  .int('price.integer')
  .min(1, 'price.required')
  .max(10_000_000, 'price.too_big');

/** Uploaded media as the admin sees it: processing state plus a preview when ready. */
export const adminMediaSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  image: imageRefSchema.nullable(),
  file: fileRefSchema.nullable(),
});
export type AdminMedia = z.infer<typeof adminMediaSchema>;

export const adminVideoSchema = z.object({
  id: z.uuid(),
  status: z.enum(['created', 'uploading', 'processing', 'ready', 'failed']),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  thumbnailUrl: z.string().nullable(),
  /** Playback in the admin: HLS for Safari, MP4 fallback for the other browsers (null until encoded). */
  hlsUrl: z.string().nullable(),
  mp4Url: z.string().nullable(),
  bytes: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminVideo = z.infer<typeof adminVideoSchema>;

// Categories and brands

export const adminCategorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  order: z.number().int(),
  count: z.number().int(),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'category.name.required').max(60, 'text.too_long'),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const brandOptionSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  /** «О бренде», shared by every product of the brand. */
  description: z.string(),
});
export const brandQuerySchema = z.object({ q: z.string().trim().max(60).optional() });

// Products

export const productInputSchema = z.object({
  name: z.string().trim().min(2, 'product.name.required').max(120, 'text.too_long'),
  /** Empty: generated from the name. */
  slug: z.union([slugSchema, z.literal('')]).default(''),
  shortName: optionalText(60),
  /** Created when it does not exist yet (autocomplete in the editor). */
  brandName: z.string().trim().min(1, 'product.brand.required').max(60, 'text.too_long'),
  /**
   * «О бренде»: stored on the brand, so every product of the brand shows it. Null leaves the brand's text as it is;
   * a string (also empty) replaces it.
   */
  brandDescription: z.string().trim().max(2000, 'text.too_long').nullable().default(null),
  categoryId: z.uuid('product.category.required'),
  volume: text(40),
  priceKgs: price,
  purpose: text(160),
  description: text(4000),
  howToUse: text(2000),
  inci: optionalText(6000),
  badge: z.enum(BADGES).nullable(),
  inStock: z.boolean(),
  published: z.boolean(),
  /** «На главной странице»: the three home rails; isNew also puts the «Новинка» label on the product. */
  bestseller: z.boolean().default(false),
  seoulChoice: z.boolean().default(false),
  isNew: z.boolean().default(false),
  /** Up to PRODUCT_IMAGES_MAX photos, the first is the main one. */
  imageIds: z.array(z.uuid()).max(PRODUCT_IMAGES_MAX, 'product.images.max'),
  seoTitle: optionalText(200),
  seoDescription: optionalText(300),
});
export type ProductInput = z.output<typeof productInputSchema>;

export const productPatchSchema = z
  .object({ inStock: z.boolean().optional(), published: z.boolean().optional() })
  .refine((value) => value.inStock !== undefined || value.published !== undefined, 'patch.empty');

export const adminProductQuerySchema = z.object({
  category: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export const adminProductRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.object({ id: z.uuid(), name: z.string() }),
  volume: z.string(),
  priceKgs: z.number().int(),
  badge: z.string().nullable(),
  inStock: z.boolean(),
  published: z.boolean(),
  image: imageRefSchema.nullable(),
  /** Programs that contain the product (it cannot be deleted while > 0). */
  programCount: z.number().int(),
});
export type AdminProductRow = z.infer<typeof adminProductRowSchema>;

export const adminProductSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  brandName: z.string(),
  brandDescription: z.string(),
  categoryId: z.uuid(),
  volume: z.string(),
  priceKgs: z.number().int(),
  purpose: z.string(),
  description: z.string(),
  howToUse: z.string(),
  inci: z.string().nullable(),
  badge: z.enum(BADGES).nullable(),
  inStock: z.boolean(),
  published: z.boolean(),
  bestseller: z.boolean(),
  seoulChoice: z.boolean(),
  isNew: z.boolean(),
  images: z.array(adminMediaSchema),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  programs: z.array(z.object({ id: z.uuid(), title: z.string() })),
  updatedAt: z.iso.datetime(),
});
export type AdminProduct = z.infer<typeof adminProductSchema>;

// Programs

const stepInput = z.object({
  productId: z.uuid(),
  text: z.string().trim().min(1, 'program.step.text.required').max(200, 'text.too_long'),
});

export const programInputSchema = z.object({
  title: z.string().trim().min(2, 'program.title.required').max(80, 'text.too_long'),
  slug: z.union([slugSchema, z.literal('')]).default(''),
  /** "акне и проблемной коже" for the heading "Уход при …". */
  headline: optionalText(80),
  symptom: text(160),
  description: text(2000),
  course: text(120),
  fit: z.array(text(160)).max(8, 'program.fit.max'),
  priceKgs: price,
  badge: z.enum(BADGES).nullable(),
  quizGoal: z.enum(QUIZ_GOALS).nullable(),
  quizSkins: z.array(z.enum(SKIN_TYPES)),
  published: z.boolean(),
  inStock: z.boolean(),
  /** Ordered product ids; steps may only use these products. */
  itemIds: z.array(z.uuid()).max(12, 'program.items.max'),
  steps: z.object({ am: z.array(stepInput).max(10), pm: z.array(stepInput).max(10) }),
  videoId: z.uuid().nullable(),
  protocolMediaId: z.uuid().nullable(),
  /** «Фото для главной», 5:4. */
  coverMediaId: z.uuid().nullable().default(null),
  seoTitle: optionalText(200),
  seoDescription: optionalText(300),
});
export type ProgramInput = z.output<typeof programInputSchema>;

export const programPatchSchema = z
  .object({ published: z.boolean().optional(), inStock: z.boolean().optional() })
  .refine((value) => value.published !== undefined || value.inStock !== undefined, 'patch.empty');

export const adminProgramRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  symptom: z.string(),
  badge: z.string().nullable(),
  priceKgs: z.number().int(),
  itemCount: z.number().int(),
  published: z.boolean(),
  inStock: z.boolean(),
  quizGoal: z.enum(QUIZ_GOALS).nullable(),
  videoStatus: adminVideoSchema.shape.status.nullable(),
  protocolStatus: adminMediaSchema.shape.status.nullable(),
  thumbs: z.array(imageRefSchema.nullable()),
});
export type AdminProgramRow = z.infer<typeof adminProgramRowSchema>;

export const adminProgramItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  shortName: z.string(),
  brand: z.string(),
  volume: z.string(),
  priceKgs: z.number().int(),
  image: imageRefSchema.nullable(),
});
export type AdminProgramItem = z.infer<typeof adminProgramItemSchema>;

export const adminProgramSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  headline: z.string().nullable(),
  symptom: z.string(),
  description: z.string(),
  course: z.string(),
  fit: z.array(z.string()),
  priceKgs: z.number().int(),
  badge: z.enum(BADGES).nullable(),
  quizGoal: z.enum(QUIZ_GOALS).nullable(),
  quizSkins: z.array(z.enum(SKIN_TYPES)),
  published: z.boolean(),
  inStock: z.boolean(),
  items: z.array(adminProgramItemSchema),
  steps: z.object({
    am: z.array(z.object({ productId: z.uuid(), text: z.string() })),
    pm: z.array(z.object({ productId: z.uuid(), text: z.string() })),
  }),
  sumKgs: z.number().int(),
  video: adminVideoSchema.nullable(),
  protocol: adminMediaSchema.nullable(),
  cover: adminMediaSchema.nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type AdminProgram = z.infer<typeof adminProgramSchema>;

// Reviews

export const adminReviewSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  isHidden: z.boolean(),
  isDemo: z.boolean(),
  media: adminMediaSchema,
  createdAt: z.iso.datetime(),
});
export type AdminReview = z.infer<typeof adminReviewSchema>;

export const createReviewsSchema = z.object({ mediaIds: z.array(z.uuid()).min(1).max(30) });
export const reviewPatchSchema = z.object({ isHidden: z.boolean() });
export const reviewOrderSchema = z.object({ ids: z.array(z.uuid()).max(500) });

// Content blocks

export const contentKeyParamsSchema = z.object({
  key: z.enum(['home', 'wholesale', 'delivery', 'privacy', 'offer']),
});
/** PUT body: `data` is validated against CONTENT_SCHEMAS[key] by the API. */
export const contentInputSchema = z.object({ data: z.record(z.string(), z.unknown()) });

// Settings

export const settingKeyParamsSchema = z.object({
  key: z.enum([
    'shop',
    'appearance',
    'currencies',
    'notifications',
    'seo',
    'analytics',
    'antispam',
    'payments',
  ]),
});
/** PUT body: `value` is validated against SETTING_SCHEMAS[key] by the API. */
export const settingInputSchema = z.object({ value: z.record(z.string(), z.unknown()) });
/** GET /admin/settings: every setting the user may edit (managers: shop, appearance, currencies). */
export const adminSettingsSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

// Users, sessions, audit (owner)

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

const passwordSchema = z.string().min(10, 'password.short').max(200, 'text.too_long');

export const createUserSchema = z.object({
  email: z.email('auth.email.invalid').trim().toLowerCase().max(200),
  name: z.string().trim().min(1, 'user.name.required').max(80, 'text.too_long'),
  role: z.enum(USER_ROLES),
  password: passwordSchema,
});
export type CreateUser = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'user.name.required').max(80, 'text.too_long').optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});
export const userPasswordSchema = z.object({ password: passwordSchema });

export const auditQuerySchema = z.object({
  entity: z.string().trim().max(40).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const auditRowSchema = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
  userName: z.string().nullable(),
  entity: z.string(),
  entityId: z.string(),
  action: z.string(),
  diff: z.record(z.string(), z.unknown()),
});
export const auditListSchema = z.object({ items: z.array(auditRowSchema), nextCursor: z.uuid().nullable() });
export type AuditRow = z.infer<typeof auditRowSchema>;

/** GET/PUT /admin/content/:key: the stored block plus the media and videos it points at. */
export const adminContentSchema = z.object({
  key: contentKeyParamsSchema.shape.key,
  data: z.record(z.string(), z.unknown()),
  media: z.array(adminMediaSchema),
  videos: z.array(adminVideoSchema),
  updatedAt: z.iso.datetime(),
});
export type AdminContent = z.infer<typeof adminContentSchema>;
