import { HttpStatus } from '@nestjs/common';
import { slugify } from '@bom/shared';
import { ApiException } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The slug to store: the requested one (409 when another row has it) or one generated from the name with a
 * numeric suffix until free.
 */
export async function resolveSlug(
  requested: string,
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (requested) {
    if (await isTaken(requested)) {
      throw new ApiException('conflict', HttpStatus.CONFLICT, 'Такой адрес уже занят', {
        slug: 'slug.taken',
      });
    }
    return requested;
  }
  const base = slugify(name) || 'item';
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new ApiException('conflict', HttpStatus.CONFLICT, 'Не удалось подобрать адрес', {
    slug: 'slug.taken',
  });
}

/** Keeps old links working after a slug change: a 308 from the old path, chains collapsed onto the new one. */
export async function redirectSlug(
  prisma: PrismaService,
  prefix: '/catalog' | '/programs',
  from: string,
  to: string,
): Promise<void> {
  if (from === to) return;
  const fromPath = `${prefix}/${from}`;
  const toPath = `${prefix}/${to}`;
  await prisma.$transaction([
    // The new path is live again: an old redirect away from it must go.
    prisma.redirect.deleteMany({ where: { fromPath: toPath } }),
    prisma.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } }),
    prisma.redirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 308 },
      update: { toPath, statusCode: 308 },
    }),
  ]);
}
