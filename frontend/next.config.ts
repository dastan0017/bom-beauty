import { resolve } from 'node:path';
import type { NextConfig } from 'next';
// Order matters: load the root .env, then fail fast on invalid configuration.
import './src/load-root-env';
import './src/env';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '..'),
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
