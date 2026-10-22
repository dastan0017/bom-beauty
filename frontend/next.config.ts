import { resolve } from 'node:path';
import type { NextConfig } from 'next';
// Order matters: load the root .env, then fail fast on invalid configuration.
import './src/load-root-env';
import { env } from './src/env';
import { securityHeaders } from './src/security-headers';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '..'),
  // Static TTF fonts for the Open Graph cards (src/lib/og.tsx) and the care scheme PDF (src/lib/scheme-pdf.ts) live
  // outside this package.
  outputFileTracingIncludes: {
    '/**': ['../packages/config/fonts/og/*.ttf', '../packages/config/fonts/pdf/*.ttf'],
  },
  typedRoutes: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/:path*',
      headers: securityHeaders({
        api: env.NEXT_PUBLIC_API_URL,
        media: env.NEXT_PUBLIC_MEDIA_URL,
        site: env.NEXT_PUBLIC_SITE_URL,
        dev: process.env.NODE_ENV !== 'production',
      }),
    },
  ],
};

export default nextConfig;
