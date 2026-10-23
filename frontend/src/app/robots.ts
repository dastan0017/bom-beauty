import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    // Payment pages are personal links (one per order), never for search engines.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/pay/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
