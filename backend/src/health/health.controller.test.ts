import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { HealthController } from './health.controller';

describe('health', () => {
  let app: INestApplication;
  let baseUrl: string;
  let databaseUp = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: () => (databaseUp ? Promise.resolve([1]) : Promise.reject(new Error('down'))),
          },
        },
        { provide: REDIS, useValue: { ping: () => Promise.resolve('PONG') } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers liveness outside the /v1 prefix', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('reports readiness of the database', async () => {
    expect((await fetch(`${baseUrl}/health/ready`)).status).toBe(200);
    databaseUp = false;
    expect((await fetch(`${baseUrl}/health/ready`)).status).toBe(503);
  });
});
