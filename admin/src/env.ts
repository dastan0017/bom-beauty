import { z } from 'zod';

// Documented in infra/.env.example; inlined by Vite at build time.
const result = z.object({ VITE_API_URL: z.url(), VITE_SITE_URL: z.url() }).safeParse(import.meta.env);

if (!result.success) {
  throw new Error(
    `Invalid admin environment: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
  );
}

export const env = result.data;
