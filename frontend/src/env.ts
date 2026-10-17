import { z } from 'zod';

// Documented in infra/.env.example. NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
const schema = z.object({
  INTERNAL_API_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(16),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_MEDIA_URL: z.url(),
  // Same value as the backend's INDEXNOW_KEY; empty switches the key file off.
  INDEXNOW_KEY: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{8,128}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const result = schema.safeParse({
  INTERNAL_API_URL: process.env.INTERNAL_API_URL,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_MEDIA_URL: process.env.NEXT_PUBLIC_MEDIA_URL,
  INDEXNOW_KEY: process.env.INDEXNOW_KEY,
});

if (!result.success) {
  const problems = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment for the site:\n${problems.join('\n')}`);
}

export const env = result.data;
