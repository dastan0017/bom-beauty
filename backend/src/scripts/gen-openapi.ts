import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { parseEnv } from '../config/env';
import { loadDevEnv } from '../config/load-env';
import { buildOpenApiDocument } from '../openapi';

/** Writes backend/openapi.json (committed; CI fails on drift). No database or Redis connection is opened. */
async function main(): Promise<void> {
  loadDevEnv();
  const env = parseEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), { logger: false });
  configureApp(app, env);
  const document = buildOpenApiDocument(app);
  const target = resolve(__dirname, '../../openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`Wrote ${target}`);
}

void main();
