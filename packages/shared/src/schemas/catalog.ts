import { z } from '../zod';
import { PROGRAM_VARIANTS } from '../enums';
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

const programThumbSchema = z.object({ slug: z.string(), image: imageRefSchema.nullable() });

/** One variant of a program as the cards and the quiz show it: its price and products. */
export const programVariantCardSchema = z.object({
  variant: z.enum(PROGRAM_VARIANTS),
  priceKgs: z.number().int(),
  itemCount: z.number().int(),
  thumbs: z.array(programThumbSchema),
  /** Its products one by one, for the saving on the cards (D48); 0 in data cached before then. */
  sumKgs: z.number().int().default(0),
});
export type ProgramVariantCard = z.infer<typeof programVariantCardSchema>;

export const programCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  symptom: z.string(),
  badge: z.string().nullable(),
  priceKgs: z.number().int(),
  inStock: z.boolean(),
  itemCount: z.number().int(),
  /** Every item of the «standard» variant, in order. */
  thumbs: z.array(programThumbSchema),
  /**
   * The variants on offer in page order (mini, standard, max), «standard» always among them; one entry means
   * the program has no choice. Price, count and thumbs above are «standard». The catalog's problem filter uses the
   * slugs of every variant. Empty only in data cached before variants existed.
   */
  variants: z.array(programVariantCardSchema).default([]),
  /** 5:4 photo for the home grid, the catalog banner and order lines. */
  cover: imageRefSchema.nullable(),
  video: videoRefSchema.pick({ durationSec: true, poster: true }).nullable(),
  /** The site ranks quiz results locally with `rankPrograms`. */
  quiz: z.object({ goal: z.string().nullable(), skins: z.array(z.string()) }),
});
export type ProgramCard = z.infer<typeof programCardSchema>;

export const routineStepSchema = z.object({ productSlug: z.string(), title: z.string(), text: z.string() });
export type RoutineStep = z.infer<typeof routineStepSchema>;

/** A variant on the program page: the products it lists and what they cost one by one. */
export const programVariantDetailSchema = programVariantCardSchema.extend({
  items: z.array(productCardSchema),
  sumKgs: z.number().int(),
});
export type ProgramVariantDetail = z.infer<typeof programVariantDetailSchema>;

export const programDetailSchema = programCardSchema.extend({
  headline: z.string().nullable(),
  course: z.string(),
  fit: z.array(z.string()),
  description: z.string(),
  /** The «standard» variant's products. */
  items: z.array(productCardSchema),
  /** Sum of item prices, for "По отдельности". */
  sumKgs: z.number().int(),
  variants: z.array(programVariantDetailSchema).default([]),
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
