import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MediaPipelineService } from '../media/media-pipeline.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RevalidateSender } from '../revalidate/revalidate.service';
import { VideosService } from '../videos/videos.service';
import { MaintenanceService } from './maintenance.service';
import { QUEUES, type JobPayloads } from './queues';

// One processor per queue; the logic lives in services so tests can call it directly.

const logFailure = (logger: Logger, job: Job | undefined, error: Error) =>
  logger.warn(
    `${job?.name ?? 'job'} ${job?.id ?? ''} failed (attempt ${job?.attemptsMade ?? 0}): ${error.message}`,
  );

@Processor(QUEUES.media, { concurrency: 1 })
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);
  constructor(private readonly pipeline: MediaPipelineService) {
    super();
  }
  async process(job: Job<JobPayloads['media.process']>): Promise<void> {
    await this.pipeline.process(job.data.mediaId);
  }
  @OnWorkerEvent('failed')
  failed(job: Job | undefined, error: Error) {
    logFailure(this.logger, job, error);
  }
}

@Processor(QUEUES.video, { concurrency: 2 })
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);
  constructor(private readonly videos: VideosService) {
    super();
  }
  async process(job: Job<JobPayloads['video.sync']>): Promise<void> {
    await this.videos.sync(job.data.videoId, job.data.attempt);
  }
  @OnWorkerEvent('failed')
  failed(job: Job | undefined, error: Error) {
    logFailure(this.logger, job, error);
  }
}

@Processor(QUEUES.notify, { concurrency: 2 })
export class NotifyProcessor extends WorkerHost {
  private readonly logger = new Logger(NotifyProcessor.name);
  constructor(private readonly notifications: NotificationsService) {
    super();
  }
  async process(job: Job<JobPayloads['notify.telegram']>): Promise<void> {
    if (job.name === 'notify.telegram') await this.notifications.telegram(job.data);
    else await this.notifications.email(job.data);
  }
  @OnWorkerEvent('failed')
  async failed(job: Job<JobPayloads['notify.telegram']> | undefined, error: Error) {
    logFailure(this.logger, job, error);
    if (job?.name === 'notify.telegram' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.notifications.telegramFailed(job.data);
    }
  }
}

@Processor(QUEUES.web, { concurrency: 4 })
export class WebProcessor extends WorkerHost {
  private readonly logger = new Logger(WebProcessor.name);
  constructor(private readonly sender: RevalidateSender) {
    super();
  }
  async process(job: Job<JobPayloads['web.revalidate'] | JobPayloads['indexnow.submit']>): Promise<void> {
    if (job.name === 'web.revalidate')
      await this.sender.send((job.data as JobPayloads['web.revalidate']).tags);
    else await this.sender.indexNow((job.data as JobPayloads['indexnow.submit']).paths);
  }
  @OnWorkerEvent('failed')
  failed(job: Job | undefined, error: Error) {
    logFailure(this.logger, job, error);
  }
}

@Processor(QUEUES.maintenance, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }
  async process(job: Job): Promise<void> {
    if (job.name === 'uploads.cleanup') await this.maintenance.uploadsCleanup();
    if (job.name === 'sessions.cleanup') await this.maintenance.sessionsCleanup();
  }
}
