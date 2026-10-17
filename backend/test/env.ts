import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv as parseDotenv } from 'node:util';
import { parseEnv, type Env } from '../src/config/env';

/** Repo-root .env (or the CI environment), pointed at the test database and Redis db 15. */
export function testEnv(overrides: Record<string, string> = {}): Env {
  const file = resolve(__dirname, '../../.env');
  const values = existsSync(file) ? parseDotenv(readFileSync(file, 'utf8')) : {};
  delete values.NODE_ENV;
  const base = { ...process.env, ...values };
  const databaseUrl = new URL(base.DATABASE_URL ?? '');
  databaseUrl.pathname = '/bom_test';
  const redisUrl = new URL(base.REDIS_URL ?? 'redis://localhost:6379');
  redisUrl.pathname = '/15';
  return parseEnv({
    ...base,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl.toString(),
    REDIS_URL: redisUrl.toString(),
    THROTTLE_ENABLED: 'false',
    LOG_LEVEL: 'silent',
    TURNSTILE_SECRET_KEY: '',
    ...overrides,
  });
}
