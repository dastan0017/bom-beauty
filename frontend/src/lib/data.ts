import {
  brandSchema,
  categorySchema,
  CONTENT_SCHEMAS,
  contentResponseSchema,
  productCardSchema,
  productDetailSchema,
  programCardSchema,
  programDetailSchema,
  publicSettingsSchema,
  redirectSchema,
  reviewCardSchema,
  SETTING_DEFAULTS,
  sitemapSchema,
} from '@bom/shared';
import type {
  ContentKey,
  ContentResponse,
  ContentValue,
  ProductCard,
  ProgramCard,
  PublicSettings,
} from '@bom/shared';
import { FOREIGN_CURRENCY_CODES } from '@bom/shared/web';
import { cache } from 'react';
import { z } from 'zod';
import { apiGet, apiGetOrNull, TAGS } from './api';

/** Used when the API is unreachable, so the header and footer still render. */
const FALLBACK_SETTINGS: PublicSettings = {
  shop: SETTING_DEFAULTS.shop,
  appearance: SETTING_DEFAULTS.appearance,
  currencies: [
    { code: 'KGS', rate: 1 },
    ...FOREIGN_CURRENCY_CODES.map((code) => ({ code, rate: SETTING_DEFAULTS.currencies[code].rate })),
  ],
  seo: { ...SETTING_DEFAULTS.seo, ogImage: null },
  analytics: { umamiWebsiteId: null, metaPixelId: null },
  turnstileSiteKey: null,
  // Without the API nobody can pay online anyway: the sheet stays the WhatsApp one.
  payments: { finik: false, defaultMethod: 'whatsapp', visa: false },
};

export const getSettings = cache(async (): Promise<PublicSettings> => {
  try {
    return await apiGet('/settings/public', publicSettingsSchema, [TAGS.settings]);
  } catch {
    return FALLBACK_SETTINGS;
  }
});

export const getPrograms = cache((): Promise<ProgramCard[]> =>
  apiGet('/catalog/programs', z.array(programCardSchema), [TAGS.programs]),
);

/** Programs for the global quiz; an API failure must not break every page. */
export const getProgramsSafe = cache(async (): Promise<ProgramCard[]> => {
  try {
    return await getPrograms();
  } catch {
    return [];
  }
});

export const getProgram = cache((slug: string) =>
  apiGetOrNull(`/catalog/programs/${encodeURIComponent(slug)}`, programDetailSchema, [
    TAGS.programs,
    TAGS.program(slug),
  ]),
);

export const getCategories = cache(() =>
  apiGet('/catalog/categories', z.array(categorySchema), [TAGS.categories, TAGS.products]),
);

export const getProducts = cache((category?: string) =>
  apiGet(
    `/catalog/products${category ? `?category=${encodeURIComponent(category)}` : ''}`,
    z.array(productCardSchema),
    [TAGS.products],
  ),
);

/** Products for the cart and the home rails on every page; an API failure must not break the page. */
export const getProductsSafe = cache(async (): Promise<ProductCard[]> => {
  try {
    return await getProducts();
  } catch {
    return [];
  }
});

export const getProduct = cache((slug: string) =>
  apiGetOrNull(`/catalog/products/${encodeURIComponent(slug)}`, productDetailSchema, [
    TAGS.products,
    TAGS.product(slug),
  ]),
);

export const getBrands = cache(() => apiGet('/catalog/brands', z.array(brandSchema), [TAGS.products]));

export const getReviews = cache(async () => {
  try {
    return await apiGet('/reviews', z.array(reviewCardSchema), [TAGS.reviews]);
  } catch {
    return [];
  }
});

export const getSitemap = cache(() =>
  apiGet('/catalog/sitemap', sitemapSchema, [TAGS.products, TAGS.programs]),
);

export interface Content<K extends ContentKey> {
  data: ContentValue<K>;
  refs: ContentResponse['refs'];
}

export const getContent = cache(async <K extends ContentKey>(key: K): Promise<Content<K> | null> => {
  const response = await apiGetOrNull(`/content/${key}`, contentResponseSchema, [
    TAGS.content,
    TAGS.contentKey(key),
  ]);
  if (!response) return null;
  return { data: CONTENT_SCHEMAS[key].parse(response.data) as ContentValue<K>, refs: response.refs };
});

export async function resolveRedirect(path: string) {
  return apiGetOrNull(`/redirects/resolve?path=${encodeURIComponent(path)}`, redirectSchema, [
    TAGS.redirects,
  ]);
}
