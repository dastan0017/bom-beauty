import { generateKeyPairSync } from 'node:crypto';
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

describe('parseEnv: Finik', () => {
  const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  });
  const prod = {
    ...valid,
    FINIK_ENV: 'prod',
    FINIK_API_KEY: 'k'.repeat(40),
    FINIK_ACCOUNT_ID: '00000000-0000-4000-8000-000000000001',
    FINIK_PRIVATE_KEY_BASE64: Buffer.from(pem).toString('base64'),
    FINIK_WEBHOOK_URL: 'https://api.bom-beauty.com/v1/webhooks/finik',
  };

  it('is off when FINIK_ENV is empty, whatever else is set', () => {
    expect(parseEnv({ ...prod, FINIK_ENV: '' }).FINIK_ENV).toBeUndefined();
  });

  it('accepts a complete production setup and a bare mock one', () => {
    expect(parseEnv({ ...prod, NODE_ENV: 'production' }).FINIK_ENV).toBe('prod');
    expect(
      parseEnv({ ...valid, FINIK_ENV: 'mock', FINIK_WEBHOOK_URL: 'http://localhost:4000/x' }).FINIK_ENV,
    ).toBe('mock');
  });

  it('refuses mock mode in production', () => {
    expect(() =>
      parseEnv({ ...valid, NODE_ENV: 'production', FINIK_ENV: 'mock', FINIK_WEBHOOK_URL: 'https://a.kg/w' }),
    ).toThrow(/FINIK_ENV: mock is for development and tests only/);
  });

  it('needs the key, account, private key and webhook URL for beta and prod', () => {
    expect(() => parseEnv({ ...valid, FINIK_ENV: 'beta' })).toThrow(
      /FINIK_WEBHOOK_URL[\s\S]*FINIK_API_KEY[\s\S]*FINIK_ACCOUNT_ID[\s\S]*FINIK_PRIVATE_KEY_BASE64/,
    );
  });

  it('rejects a broken private key, a webhook URL with a query and plain http in production', () => {
    expect(() => parseEnv({ ...prod, FINIK_PRIVATE_KEY_BASE64: 'bm90IGEga2V5' })).toThrow(
      /FINIK_PRIVATE_KEY_BASE64: is not a base64 PEM private key/,
    );
    expect(() => parseEnv({ ...prod, FINIK_WEBHOOK_URL: 'https://a.kg/w?x=1' })).toThrow(/no query string/);
    expect(() => parseEnv({ ...prod, NODE_ENV: 'production', FINIK_WEBHOOK_URL: 'http://a.kg/w' })).toThrow(
      /must be https/,
    );
  });
});
