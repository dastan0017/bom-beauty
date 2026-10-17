import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from './config/env';

/** HTTP setup shared by main.ts, tests and OpenAPI generation. */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(hardeningHeaders);
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  // The admin origin may send cookies; the site origin only calls public endpoints without credentials.
  app.enableCors((request: { headers: { origin?: string } }, callback) => {
    const origin = request.headers.origin;
    if (origin === env.ADMIN_ORIGIN) return callback(null, { origin: true, credentials: true, maxAge: 600 });
    if (origin === env.WEB_ORIGIN) return callback(null, { origin: true, credentials: false, maxAge: 600 });
    return callback(null, { origin: false });
  });
  app.enableShutdownHooks();
}

const PRIVATE_PATH = /^\/v1\/(admin|auth)(\/|$)/;

/** JSON-only API: no sniffing, no framing, no referrer; admin and auth answers (personal data) are never cached. */
function hardeningHeaders(request: Request, response: Response, next: NextFunction): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (PRIVATE_PATH.test(request.path)) response.setHeader('Cache-Control', 'no-store');
  next();
}
