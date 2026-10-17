import type { MetadataRoute } from 'next';
import { getSitemap } from '@/lib/data';
import { absoluteUrl } from '@/lib/seo';

const STATIC_PATHS = ['/', '/programs', '/catalog', '/wholesale', '/delivery', '/privacy', '/offer'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }));
  const data = await getSitemap().catch(() => null);
  if (!data) return pages;
  return [
    ...pages,
    ...data.programs.map((program) => ({
      url: absoluteUrl(`/programs/${program.slug}`),
      lastModified: program.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...data.products.map((product) => ({
      url: absoluteUrl(`/catalog/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
