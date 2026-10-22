import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  buildOrderMessage,
  buildQuizMessage,
  buildWholesaleMessage,
  formatKgs,
  normalizePhone,
  rankPrograms,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  type ContentKey,
  type ContentValue,
} from '@bom/shared';
import { loadDevEnv } from '../config/load-env';
import { PrismaClient } from '../generated/prisma/client';
import {
  BRANDS,
  CATEGORIES,
  COMPOSITION,
  DELIVERY_CONTENT,
  DEMO_ORDERS,
  HOME_CONTENT,
  HOME_RAILS,
  OFFER_CONTENT,
  PRIVACY_CONTENT,
  PRODUCTS,
  PROGRAMS,
  WHOLESALE_CONTENT,
  WHOLESALE_FEATURED,
} from './seed-data';

/**
 * Idempotent and non-destructive: rows that already exist (by slug or key) are left alone, so re-running the seed
 * never overwrites what the owner changed in the admin. Demo orders and leads are added only outside production and
 * only into an empty table.
 */
export async function seed(
  prisma: PrismaClient,
  options: { demo: boolean; owner?: { email: string; password: string; name: string } },
): Promise<void> {
  for (const [order, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: { ...category, order },
    });
  }
  for (const brand of BRANDS) {
    await prisma.brand.upsert({ where: { slug: brand.slug }, update: {}, create: brand });
  }

  const categoryIds = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  const brandIds = new Map(
    (await prisma.brand.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]),
  );
  const lookup = <T>(map: Map<string, T>, key: string): T => {
    const value = map.get(key);
    if (value === undefined) throw new Error(`Seed: unknown key "${key}"`);
    return value;
  };

  const productIds = new Map<string, string>();
  for (const [order, product] of PRODUCTS.entries()) {
    const { key, category, brand, badge, ...fields } = product;
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        ...fields,
        badge: badge ?? null,
        inci: COMPOSITION[key] ?? null,
        bestseller: HOME_RAILS.bestseller.includes(key),
        seoulChoice: HOME_RAILS.seoulChoice.includes(key),
        isNew: HOME_RAILS.isNew.includes(key),
        order,
        categoryId: lookup(categoryIds, category),
        brandId: lookup(brandIds, brand),
      },
      select: { id: true },
    });
    productIds.set(key, row.id);
  }

  for (const [order, program] of PROGRAMS.entries()) {
    const exists = await prisma.program.findUnique({ where: { slug: program.slug }, select: { id: true } });
    if (exists) continue;
    const { items, am, pm, ...fields } = program;
    // A step must use one of the program's products (the admin enforces the same rule).
    const inProgram = ([key]: [string, string]) => items.includes(key);
    await prisma.program.create({
      data: {
        ...fields,
        published: true,
        order,
        items: { create: items.map((key, index) => ({ productId: lookup(productIds, key), order: index })) },
        steps: {
          create: [
            ...am.filter(inProgram).map(([key, text], index) => ({
              period: 'am' as const,
              order: index,
              productId: lookup(productIds, key),
              text,
            })),
            ...pm.filter(inProgram).map(([key, text], index) => ({
              period: 'pm' as const,
              order: index,
              productId: lookup(productIds, key),
              text,
            })),
          ],
        },
      },
    });
  }

  for (const key of SETTING_KEYS) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: SETTING_DEFAULTS[key] },
    });
  }

  const content: { [K in ContentKey]: ContentValue<K> } = {
    home: HOME_CONTENT,
    wholesale: {
      ...WHOLESALE_CONTENT,
      featuredProductIds: WHOLESALE_FEATURED.map((key) => lookup(productIds, key)),
    },
    delivery: DELIVERY_CONTENT,
    privacy: PRIVACY_CONTENT,
    offer: OFFER_CONTENT,
  };
  for (const [key, data] of Object.entries(content)) {
    await prisma.contentBlock.upsert({ where: { key }, update: {}, create: { key, data } });
  }

  if (
    options.owner &&
    !(await prisma.user.findUnique({ where: { email: options.owner.email.toLowerCase() } }))
  ) {
    await prisma.user.create({
      data: {
        email: options.owner.email.toLowerCase(),
        name: options.owner.name,
        role: 'owner',
        passwordHash: await hash(options.owner.password),
      },
    });
  }

  if (options.demo) await seedDemo(prisma);
}

/** Dev-only sample data so the admin has something to show. */
async function seedDemo(prisma: PrismaClient): Promise<void> {
  if (!(await prisma.user.findUnique({ where: { email: 'manager@bom-beauty.com' } }))) {
    await prisma.user.create({
      data: {
        email: 'manager@bom-beauty.com',
        name: 'Менеджер (демо)',
        role: 'manager',
        passwordHash: await hash('manager-dev-password'),
      },
    });
  }

  if ((await prisma.order.count()) === 0) {
    const products = await prisma.product.findMany({
      select: { id: true, slug: true, name: true, priceKgs: true },
    });
    const programs = await prisma.program.findMany({
      select: { id: true, slug: true, title: true, priceKgs: true },
    });
    const productBySeedKey = new Map(
      PRODUCTS.map((p) => [p.key, products.find((row) => row.slug === p.slug)]),
    );

    // Oldest first, so order numbers grow with time.
    for (const demo of [...DEMO_ORDERS].reverse()) {
      const lines = demo.lines.flatMap((line) => {
        const product = line.type === 'product' ? productBySeedKey.get(line.key) : undefined;
        const program = line.type === 'program' ? programs.find((p) => p.slug === line.key) : undefined;
        const item = product
          ? { type: 'product' as const, productId: product.id, title: product.name, price: product.priceKgs }
          : program
            ? {
                type: 'program' as const,
                programId: program.id,
                title: program.title,
                price: program.priceKgs,
              }
            : null;
        if (!item) return [];
        const { price, ...ref } = item;
        return [{ ...ref, unitPriceKgs: price, qty: line.qty, totalKgs: price * line.qty }];
      });
      if (!lines.length) continue;
      const totalKgs = lines.reduce((sum, line) => sum + line.totalKgs, 0);
      const address = `${demo.city}, ул. Демо, 1`;
      const createdAt = bishkekTime(demo.daysAgo, demo.time);
      await prisma.order.create({
        data: {
          status: demo.status,
          lines: { create: lines.map((line, position) => ({ ...line, position })) },
          totalKgs,
          name: demo.name,
          phone: normalizePhone(demo.phone) ?? demo.phone,
          address,
          message: buildOrderMessage({
            lines: lines.map((line) => ({ ...line, total: formatKgs(line.totalKgs) })),
            total: formatKgs(totalKgs),
            name: demo.name,
            phone: demo.phone,
            address,
          }),
          pageUrl: 'http://localhost:3100/',
          clientRef: randomUUID(),
          createdAt,
          statusChangedAt: createdAt,
        },
      });
    }
  }

  if ((await prisma.lead.count()) === 0) {
    const published = await prisma.program.findMany({
      where: { published: true },
      orderBy: { order: 'asc' },
      select: { slug: true, title: true, priceKgs: true, quizGoal: true, quizSkins: true },
    });
    const answers = { goal: 'acne', skin: 'combo', exp: 'some', age: '25' } as const;
    const ranked = rankPrograms(published, answers);
    await prisma.lead.create({
      data: {
        kind: 'quiz',
        answers,
        recommended: ranked.map((p) => p.slug),
        choose: true,
        message: buildQuizMessage(
          answers,
          ranked.map((p) => ({ title: p.title, price: formatKgs(p.priceKgs) })),
        ),
        pageUrl: 'http://localhost:3100/',
        clientRef: randomUUID(),
        createdAt: bishkekTime(0, '11:05'),
      },
    });
    const wholesale = { buyer: 'salon', country: 'kz' } as const;
    await prisma.lead.create({
      data: {
        kind: 'wholesale',
        answers: wholesale,
        recommended: [],
        message: buildWholesaleMessage(wholesale),
        pageUrl: 'http://localhost:3100/wholesale',
        clientRef: randomUUID(),
        createdAt: bishkekTime(1, '15:20'),
      },
    });
  }
}

/** A moment `daysAgo` days back at hh:mm Asia/Bishkek (UTC+6, no DST). */
function bishkekTime(daysAgo: number, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const bishkekNow = new Date(Date.now() + 6 * 3_600_000);
  return new Date(
    Date.UTC(
      bishkekNow.getUTCFullYear(),
      bishkekNow.getUTCMonth(),
      bishkekNow.getUTCDate() - daysAgo,
      hours - 6,
      minutes,
    ),
  );
}

async function main(): Promise<void> {
  loadDevEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  const { SEED_OWNER_EMAIL: email, SEED_OWNER_PASSWORD: password, SEED_OWNER_NAME: name } = process.env;
  try {
    await seed(prisma, {
      demo: process.env.NODE_ENV !== 'production',
      ...(email && password ? { owner: { email, password, name: name ?? 'Владелец' } } : {}),
    });
    console.log('Seed complete');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
