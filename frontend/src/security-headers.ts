// Response headers for every site page (docs/ARCHITECTURE.md §8.3). Caddy adds HSTS in production.
//
// The CSP is pragmatic: Next's streamed bootstrap is inline, so scripts allow 'unsafe-inline'; everything else is
// limited to the hosts the site really talks to. Turnstile and the Meta Pixel are listed because the owner can switch
// them on in the admin without a deploy.

export interface SiteOrigins {
  /** Browser-side API (orders, leads). */
  api: string;
  /** Processed photos and PDFs. */
  media: string;
  /** The site's own URL: https turns on upgrade-insecure-requests (a local production run stays on http). */
  site: string;
  dev: boolean;
}

const TURNSTILE = 'https://challenges.cloudflare.com';
const META = ['https://connect.facebook.net', 'https://www.facebook.com'];
const BUNNY = 'https://*.b-cdn.net';

export function contentSecurityPolicy({ api, media, site, dev }: SiteOrigins): string {
  const apiOrigin = new URL(api).origin;
  const mediaOrigin = new URL(media).origin;
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", TURNSTILE, META[0] ?? '', ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', mediaOrigin, BUNNY, ...META],
    'media-src': ["'self'", 'blob:', mediaOrigin, BUNNY],
    'font-src': ["'self'"],
    'connect-src': ["'self'", apiOrigin, mediaOrigin, BUNNY, TURNSTILE, ...META, ...(dev ? ['ws:'] : [])],
    'frame-src': [TURNSTILE],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    ...(new URL(site).protocol === 'https:' ? { 'upgrade-insecure-requests': [] } : {}),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...new Set(values)].join(' '))
    .join('; ');
}

export function securityHeaders(origins: SiteOrigins): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(origins) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ];
}
