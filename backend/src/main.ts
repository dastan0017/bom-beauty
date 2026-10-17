import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { parseEnv } from './config/env';
import { loadDevEnv } from './config/load-env';
import { buildOpenApiDocument } from './openapi';
import { WorkerModule } from './worker/worker.module';

async function bootstrap(): Promise<void> {
  loadDevEnv();
  const env = parseEnv(process.env);

  if (process.argv.includes('--worker')) {
    const worker = await NestFactory.createApplicationContext(WorkerModule.forRoot(env), {
      bufferLogs: true,
    });
    worker.useLogger(worker.get(Logger));
    worker.enableShutdownHooks();
    worker.get(Logger).log('Worker started');
    return;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app, env);
  if (env.NODE_ENV !== 'production') SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
  await app.listen(env.API_PORT);
}

void bootstrap();
