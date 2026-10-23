import { createPrivateKey, createPublicKey } from 'node:crypto';
import { z } from 'zod';

// Every variable is documented in infra/.env.example. Empty strings count as "not set".
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** PEM text from a one-line base64 env value (`base64 < finik_private.pem | tr -d '\n'`). */
export const pemFromBase64 = (value: string): string => Buffer.from(value.trim(), 'base64').toString('utf8');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().startsWith('postgres'),
    REDIS_URL: z.string().startsWith('redis'),

    WEB_ORIGIN: z.url(),
    ADMIN_ORIGIN: z.url(),
    WEB_INTERNAL_URL: z.url(),

    SESSION_SECRET: z.string().min(32),
    IP_HASH_SALT: z.string().min(16),
    REVALIDATE_SECRET: z.string().min(16),
    RUN_WORKER_IN_API: flag.default(false),
    /** Number of reverse proxies in front of the API (prod: Caddy = 1). Used for the client IP in rate limits. */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    /** Disables rate limiting; only for automated tests. */
    THROTTLE_ENABLED: flag.default(true),

    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_PUBLIC_BUCKET: z.string().min(1),
    S3_PRIVATE_BUCKET: z.string().min(1),
    S3_FORCE_PATH_STYLE: flag.default(false),
    MEDIA_PUBLIC_URL: z.url(),

    BUNNY_LIBRARY_ID: optionalString,
    BUNNY_API_KEY: optionalString,
    BUNNY_CDN_HOST: optionalString,
    TELEGRAM_BOT_TOKEN: optionalString,
    SMTP_URL: optionalString,
    MAIL_FROM: optionalString,
    SENTRY_DSN: optionalString,
    TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,
    INDEXNOW_KEY: optionalString,

    // Online payment through Finik (docs/finik/SPEC.md §5.2). Unset FINIK_ENV = online payment off.
    /** mock: local fake Finik (development and tests only) · beta: no real money · prod. */
    FINIK_ENV: z.preprocess(emptyToUndefined, z.enum(['mock', 'beta', 'prod']).optional()),
    FINIK_API_KEY: optionalString,
    FINIK_ACCOUNT_ID: optionalString,
    /** Our RSA private key, PEM as one base64 line. */
    FINIK_PRIVATE_KEY_BASE64: optionalString,
    /** Finik's webhook public key, PEM as base64; empty = the built-in key of FINIK_ENV. */
    FINIK_PUBLIC_KEY_BASE64: optionalString,
    /** Where Finik posts payment webhooks; its host and path are part of Finik's signature. */
    FINIK_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (!env.FINIK_ENV) return;
    if (env.FINIK_ENV === 'mock' && env.NODE_ENV === 'production') {
      issue('FINIK_ENV', 'mock is for development and tests only');
    }
    if (!env.FINIK_WEBHOOK_URL) issue('FINIK_WEBHOOK_URL', 'required when FINIK_ENV is set');
    else {
      const url = new URL(env.FINIK_WEBHOOK_URL);
      if (url.search || url.hash) issue('FINIK_WEBHOOK_URL', 'must have no query string or fragment');
      if (env.NODE_ENV === 'production' && url.protocol !== 'https:')
        issue('FINIK_WEBHOOK_URL', 'must be https');
    }
    if (env.FINIK_ENV === 'mock') return;
    for (const key of ['FINIK_API_KEY', 'FINIK_ACCOUNT_ID', 'FINIK_PRIVATE_KEY_BASE64'] as const) {
      if (!env[key]) issue(key, `required when FINIK_ENV is ${env.FINIK_ENV}`);
    }
    try {
      if (env.FINIK_PRIVATE_KEY_BASE64) createPrivateKey(pemFromBase64(env.FINIK_PRIVATE_KEY_BASE64));
    } catch {
      issue('FINIK_PRIVATE_KEY_BASE64', 'is not a base64 PEM private key');
    }
    try {
      if (env.FINIK_PUBLIC_KEY_BASE64) createPublicKey(pemFromBase64(env.FINIK_PUBLIC_KEY_BASE64));
    } catch {
      issue('FINIK_PUBLIC_KEY_BASE64', 'is not a base64 PEM public key');
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates the environment once at boot; exits with a readable list of problems. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }
  return result.data;
}
