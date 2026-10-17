import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Env } from './config/env';

/** HTTP setup shared by main.ts, tests and OpenAPI generation. */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.set('trust proxy', env.TRUST_PROXY);
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
