import { z } from '../zod';
import { QUIZ_GOALS, SKIN_TYPES } from '../enums';
import { fileRefSchema, imageRefSchema, videoRefSchema } from './common';

// Public catalog responses (docs/API.md §4).

export const categorySchema = z.object({ slug: z.string(), name: z.string(), count: z.number().int() });
export type Category = z.infer<typeof categorySchema>;

export const productCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  /** Short name for routine steps ("Cica-сыворотка"); equals name when not set. */
  shortName: z.string(),
  brand: z.string(),
  category: z.object({ slug: z.string(), name: z.string() }),
  volume: z.string(),
  purpose: z.string(),
  priceKgs: z.number().int(),
  /** The one label the card shows: «Новинка» for new products, otherwise the product's own badge. */
  badge: z.string().nullable(),
  inStock: z.boolean(),
  /** Home page rails: «Бестселлеры BOM BEAUTY», «Выбор клиник Сеула», «Новинки». */
  bestseller: z.boolean(),
  seoulChoice: z.boolean(),
  isNew: z.boolean(),
  image: imageRefSchema.nullable(),
  /** Ready product video: the catalog card and the product gallery open it in the player. */
  video: videoRefSchema.nullable().default(null),
});
export type ProductCard = z.infer<typeof productCardSchema>;

const seoSchema = z.object({ title: z.string().nullable(), description: z.string().nullable() });

export const productDetailSchema = productCardSchema.extend({
  /** «О бренде» above «Описание»; the same for every product of the brand, empty hides it. */
  brandDescription: z.string().default(''),
  description: z.string(),
  howToUse: z.string(),
  inci: z.string().nullable(),
  images: z.array(imageRefSchema),
  programs: z.array(z.object({ slug: z.string(), title: z.string() })),
  /** «С этим средством ещё берут»: up to 6 other products (README §6.1). */
  related: z.array(productCardSchema),
  seo: seoSchema,
  updatedAt: z.iso.datetime(),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const programCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  symptom: z.string(),
  badge: z.string().nullable(),
  priceKgs: z.number().int(),
  inStock: z.boolean(),
  itemCount: z.number().int(),
  /** Every item of the program, in order (the catalog's problem filter uses the slugs). */
  thumbs: z.array(z.object({ slug: z.string(), image: imageRefSchema.nullable() })),
  /** 5:4 photo for the home grid, the catalog banner and order lines. */
  cover: imageRefSchema.nullable(),
  video: videoRefSchema.pick({ durationSec: true, poster: true }).nullable(),
  /** The site ranks quiz results locally with `rankPrograms`. */
  quiz: z.object({ goal: z.enum(QUIZ_GOALS).nullable(), skins: z.array(z.enum(SKIN_TYPES)) }),
});
export type ProgramCard = z.infer<typeof programCardSchema>;

export const routineStepSchema = z.object({ productSlug: z.string(), title: z.string(), text: z.string() });
export type RoutineStep = z.infer<typeof routineStepSchema>;

export const programDetailSchema = programCardSchema.extend({
  headline: z.string().nullable(),
  course: z.string(),
  fit: z.array(z.string()),
  description: z.string(),
  items: z.array(productCardSchema),
  /** Sum of item prices, for "По отдельности". */
  sumKgs: z.number().int(),
  steps: z.object({ am: z.array(routineStepSchema), pm: z.array(routineStepSchema) }),
  video: videoRefSchema.nullable(),
  protocol: fileRefSchema.nullable(),
  seo: seoSchema,
  updatedAt: z.iso.datetime(),
});
export type ProgramDetail = z.infer<typeof programDetailSchema>;

export const brandSchema = z.object({ slug: z.string(), name: z.string() });
export type Brand = z.infer<typeof brandSchema>;

export const sitemapSchema = z.object({
  programs: z.array(z.object({ slug: z.string(), updatedAt: z.iso.datetime() })),
  products: z.array(z.object({ slug: z.string(), updatedAt: z.iso.datetime() })),
});
export type Sitemap = z.infer<typeof sitemapSchema>;

export const reviewCardSchema = z.object({ id: z.uuid(), image: imageRefSchema });
export type ReviewCard = z.infer<typeof reviewCardSchema>;

export const redirectSchema = z.object({ toPath: z.string(), statusCode: z.number().int() });
export type RedirectTarget = z.infer<typeof redirectSchema>;
