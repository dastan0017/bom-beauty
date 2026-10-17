import { BullModule } from '@nestjs/bullmq';
import { Global, Module, type DynamicModule, type OnApplicationBootstrap } from '@nestjs/common';
import type { Env } from '../config/env';
import { MediaPipelineService } from '../media/media-pipeline.service';
import { RevalidateSender } from '../revalidate/revalidate.service';
import { VideosService } from '../videos/videos.service';
import { JobsService } from './jobs.service';
import { MaintenanceService } from './maintenance.service';
import {
  MaintenanceProcessor,
  MediaProcessor,
  NotifyProcessor,
  VideoProcessor,
  WebProcessor,
} from './processors';
import { QUEUES } from './queues';

/** BullMQ connection options from a redis:// URL (workers need maxRetriesPerRequest: null). */
export function redisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    db: Number(parsed.pathname.replace('/', '') || 0),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    maxRetriesPerRequest: null,
  };
}

const PROCESSORS = [MediaProcessor, VideoProcessor, NotifyProcessor, WebProcessor, MaintenanceProcessor];
const PROCESSOR_SERVICES = [MediaPipelineService, VideosService, RevalidateSender, MaintenanceService];

/**
 * Queues for every process; processors only in the worker (`--worker`) or in the API when RUN_WORKER_IN_API is on
 * (development and tests).
 */
@Global()
@Module({})
export class JobsModule implements OnApplicationBootstrap {
  private static processors = false;

  constructor(private readonly jobs: JobsService) {}

  static forRoot(env: Env, options: { processors: boolean }): DynamicModule {
    JobsModule.processors = options.processors;
    return {
      module: JobsModule,
      imports: [
        BullModule.forRoot({ connection: redisConnection(env.REDIS_URL), prefix: 'bom' }),
        BullModule.registerQueue(...Object.values(QUEUES).map((name) => ({ name }))),
      ],
      providers: [JobsService, ...(options.processors ? [...PROCESSOR_SERVICES, ...PROCESSORS] : [])],
      exports: [JobsService],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (JobsModule.processors) await this.jobs.schedule();
  }
}
