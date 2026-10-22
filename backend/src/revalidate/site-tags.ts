/** Cache tags of the site (frontend/src/lib/api.ts). Kept apart from the Nest service so the seed can import it. */
export const SITE_TAGS = {
  settings: 'settings',
  categories: 'categories',
  products: 'products',
  product: (slug: string) => `product:${slug}`,
  programs: 'programs',
  program: (slug: string) => `program:${slug}`,
  content: 'content',
  contentKey: (key: string) => `content:${key}`,
  reviews: 'reviews',
  redirects: 'redirects',
} as const;
