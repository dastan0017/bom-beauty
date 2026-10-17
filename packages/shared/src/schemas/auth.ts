import { z } from '../zod';
import { USER_ROLES } from '../enums';

export const loginSchema = z.object({
  email: z.email('auth.email.invalid').trim().toLowerCase().max(200),
  password: z.string().min(1, 'auth.password.required').max(200),
  remember: z.boolean().default(false),
});
export type LoginInput = z.input<typeof loginSchema>;

export const sessionUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(USER_ROLES),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Returned by login and /auth/me. The admin sends `csrfToken` as `X-CSRF-Token` on every mutation. */
export const authSessionSchema = z.object({ user: sessionUserSchema, csrfToken: z.string() });
export type AuthSession = z.infer<typeof authSessionSchema>;
