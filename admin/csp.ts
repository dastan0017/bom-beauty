import { z } from 'zod';

// Admin Content-Security-Policy, written into index.html at build time (docs/ARCHITECTURE.md §8.3). A <meta> policy
// cannot carry frame-ancestors; Caddy sends that one as a header.

const schema = z.object({
  VITE_API_URL: z.url(),
  VITE_MEDIA_URL: z.url(),
  // Presigned POST target: S3_ENDPOINT (path-style) or the private bucket's own host (virtual-hosted style).
  VITE_UPLOAD_ORIGIN: z.url(),
});

export function adminCsp(values: Record<string, string>): string {
  const env = schema.parse(values);
  const origin = (url: string) => new URL(url).origin;
  const media = origin(env.VITE_MEDIA_URL);
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', media, 'https://*.b-cdn.net'],
    'media-src': ["'self'", 'blob:', media, 'https://*.b-cdn.net'],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      origin(env.VITE_API_URL),
      origin(env.VITE_UPLOAD_ORIGIN),
      'https://video.bunnycdn.com',
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...new Set(values)].join(' '))
    .join('; ');
}
