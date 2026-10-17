import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://bom:bom@localhost:5434/bom',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:3100',
  ADMIN_ORIGIN: 'http://localhost:5173',
  WEB_INTERNAL_URL: 'http://localhost:3100',
  SESSION_SECRET: 'x'.repeat(32),
  IP_HASH_SALT: 'y'.repeat(16),
  REVALIDATE_SECRET: 'z'.repeat(16),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'bom',
  S3_SECRET_KEY: 'bom-secret',
  S3_PUBLIC_BUCKET: 'bom-public',
  S3_PRIVATE_BUCKET: 'bom-private',
  MEDIA_PUBLIC_URL: 'http://localhost:9000/bom-public',
  TELEGRAM_BOT_TOKEN: '',
};

describe('parseEnv', () => {
  it('applies defaults and treats empty optionals as unset', () => {
    const env = parseEnv(valid);
    expect(env.API_PORT).toBe(4000);
    expect(env.RUN_WORKER_IN_API).toBe(false);
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it('lists every problem', () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: 'short', DATABASE_URL: 'mysql://x' })).toThrow(
      /SESSION_SECRET[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*SESSION_SECRET/,
    );
  });
});
