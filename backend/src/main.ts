import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { parseEnv } from './config/env';
import { loadDevEnv } from './config/load-env';
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

  const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  // Per-route CORS rules (credentials only for the admin origin) arrive with auth in M1.
  app.enableCors({ origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN], credentials: true });
  app.enableShutdownHooks();
  await app.listen(env.API_PORT);
}

void bootstrap();
