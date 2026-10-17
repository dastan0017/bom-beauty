import { z } from 'zod';

// Every variable is documented in infra/.env.example. Empty strings count as "not set".
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().startsWith('postgres'),
  REDIS_URL: z.string().startsWith('redis'),

  WEB_ORIGIN: z.url(),
  ADMIN_ORIGIN: z.url(),
  WEB_INTERNAL_URL: z.url(),

  SESSION_SECRET: z.string().min(32),
  IP_HASH_SALT: z.string().min(16),
  REVALIDATE_SECRET: z.string().min(16),
  RUN_WORKER_IN_API: flag.default(false),

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
  TURNSTILE_SECRET_KEY: optionalString,
  INDEXNOW_KEY: optionalString,
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
