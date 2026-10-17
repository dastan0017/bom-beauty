import type { ImageRef, PublicSettings } from '@bom/shared';
import { env } from '@/env';
import { variantUrl } from './media';

/** Repeated in every page's `openGraph`, because Next merges metadata objects shallowly. */
export const BASE_OPEN_GRAPH = { type: 'website', locale: 'ru_RU', siteName: 'Bom Beauty' } as const;

export const absoluteUrl = (path: string): string => new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();

/** Largest WebP variant up to 1280 px for Open Graph. */
export function ogImageUrl(image: ImageRef): string {
  const sorted = [...image.widths].sort((a, b) => a - b);
  const width = [...sorted].reverse().find((w) => w <= 1280) ?? sorted[0] ?? 1280;
  return variantUrl(image.id, width, 'webp');
}

/** Image URL for JSON-LD and OG, or undefined while there is no photo. */
export function imageUrl(image: ImageRef | null | undefined): string | undefined {
  return image ? ogImageUrl(image) : undefined;
}

type JsonLd = Record<string, unknown>;

export function organizationLd(settings: PublicSettings): JsonLd {
  const sameAs = [settings.shop.instagramShop, settings.shop.instagramOwner]
    .filter(Boolean)
    .map((handle) => `https://instagram.com/${handle}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: settings.shop.name,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/brand/bom-lockup-full.png'),
    telephone: settings.shop.whatsapp,
    address: { '@type': 'PostalAddress', addressLocality: 'Бишкек', addressCountry: 'KG' },
    currenciesAccepted: 'KGS',
    paymentAccepted: 'Bank transfer',
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function breadcrumbsLd(items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productLd(input: {
  name: string;
  description: string;
  path: string;
  brand: string;
  priceKgs: number;
  inStock: boolean;
  images: (string | undefined)[];
  sku?: string;
}): JsonLd {
  const images = input.images.filter((url): url is string => Boolean(url));
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    brand: { '@type': 'Brand', name: input.brand },
    ...(input.sku ? { sku: input.sku } : {}),
    ...(images.length ? { image: images } : {}),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(input.path),
      priceCurrency: 'KGS',
      price: input.priceKgs,
      availability: input.inStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    },
  };
}

export function faqLd(faq: { q: string; a: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Plain-text excerpt for meta descriptions. */
export function excerpt(text: string, max = 160): string {
  const clean = text
    .replace(/[*_#>`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
