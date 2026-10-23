import { randomUUID } from 'node:crypto';
import type { Utm } from '@bom/shared';
import { Prisma } from '../generated/prisma/client';

/** Honeypot filled → pretend success, store nothing. */
export const isBot = (website: string | undefined): boolean => Boolean(website?.trim());

export const fakeId = (): string => randomUUID();

export const utmJson = (utm: Utm | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  utm && Object.keys(utm).length ? utm : Prisma.DbNull;

/** True when a write failed on a unique index (P2002). */
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** True when a create failed because the unique clientRef already exists (a retried submission). */
export const isDuplicateClientRef = isUniqueViolation;
