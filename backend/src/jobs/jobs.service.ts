import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { JOB_QUEUE, QUEUES, type JobName, type JobPayloads } from './queues';

const DEFAULTS: Record<JobName, JobsOptions> = {
  'media.process': { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
  'video.sync': { attempts: 3, backoff: { type: 'fixed', delay: 30_000 } },
  'notify.telegram': { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } },
  'notify.email': { attempts: 5, backoff: { type: 'exponential', delay: 30_000 } },
  'web.revalidate': { attempts: 8, backoff: { type: 'exponential', delay: 2_000 } },
  'indexnow.submit': { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  'uploads.cleanup': { attempts: 1 },
  'sessions.cleanup': { attempts: 1 },
};

/** Enqueues background jobs; processors run in the worker (`--worker`) or in the API with RUN_WORKER_IN_API. */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly queues: Record<string, Queue>;

  constructor(
    @InjectQueue(QUEUES.media) media: Queue,
    @InjectQueue(QUEUES.video) video: Queue,
    @InjectQueue(QUEUES.notify) notify: Queue,
    @InjectQueue(QUEUES.web) web: Queue,
    @InjectQueue(QUEUES.maintenance) maintenance: Queue,
  ) {
    this.queues = { media, video, notify, web, maintenance };
  }

  async add<N extends JobName>(name: N, data: JobPayloads[N], options: JobsOptions = {}): Promise<void> {
    const queue = this.queues[JOB_QUEUE[name]];
    if (!queue) throw new Error(`No queue for ${name}`);
    await queue.add(name, data, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      ...DEFAULTS[name],
      ...options,
    });
  }

  /** Same as add, but a Redis hiccup is logged instead of failing the request that triggered it. */
  async addSafely<N extends JobName>(
    name: N,
    data: JobPayloads[N],
    options: JobsOptions = {},
  ): Promise<void> {
    try {
      await this.add(name, data, options);
    } catch (error) {
      this.logger.error(`Could not enqueue ${name}: ${String(error)}`);
    }
  }

  /** Recurring maintenance (Asia/Bishkek times). Idempotent: re-running replaces the schedule. */
  async schedule(): Promise<void> {
    const maintenance = this.queues.maintenance;
    if (!maintenance) return;
    await maintenance.upsertJobScheduler(
      'uploads.cleanup',
      { pattern: '17 * * * *', tz: 'Asia/Bishkek' },
      { name: 'uploads.cleanup', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
    );
    await maintenance.upsertJobScheduler(
      'sessions.cleanup',
      { pattern: '40 4 * * *', tz: 'Asia/Bishkek' },
      { name: 'sessions.cleanup', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
    );
  }
}
