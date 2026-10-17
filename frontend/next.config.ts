import { resolve } from 'node:path';
import type { NextConfig } from 'next';
// Order matters: load the root .env, then fail fast on invalid configuration.
import './src/load-root-env';
import './src/env';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '..'),
  // Static TTF fonts for the Open Graph cards (src/lib/og.tsx) live outside this package.
  outputFileTracingIncludes: { '/**': ['../packages/config/fonts/og/*.ttf'] },
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
