import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { seed } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Env } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { testEnv } from './env';

export const OWNER = { email: 'owner@test.kg', password: 'owner-test-password', name: 'Нурайым' };

export interface TestContext {
  app: INestApplication;
  env: Env;
  prisma: PrismaService;
  url: (path: string) => string;
  close: () => Promise<void>;
}

/** Full app on a random port, with a freshly seeded test database and an empty Redis db. */
export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestContext> {
  const env = testEnv(overrides);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, env);
  await app.listen(0);
  const base = await app.getUrl();
  const prisma = app.get(PrismaService);

  await resetDatabase(prisma);
  await seed(prisma, { demo: false, owner: OWNER });
  const redis = new Redis(env.REDIS_URL);
  await redis.flushdb();
  await redis.quit();

  return {
    app,
    env,
    prisma,
    url: (path) => `${base.replace('[::1]', 'localhost')}${path}`,
    close: () => app.close(),
  };
}

async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "orders_number_seq" RESTART WITH 1001');
}

export interface JsonResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

export async function request<T = unknown>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<JsonResponse<T>> {
  const { json, headers, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers };
}
