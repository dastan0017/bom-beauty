// BullMQ queues and job payloads (docs/API.md §8).

export const QUEUES = {
  media: 'media',
  video: 'video',
  notify: 'notify',
  web: 'web',
  maintenance: 'maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface JobPayloads {
  'media.process': { mediaId: string };
  'video.sync': { videoId: string; attempt: number };
  'notify.telegram': { entity: 'order' | 'lead'; id: string };
  'notify.email': { entity: 'order' | 'lead'; id: string };
  'web.revalidate': { tags: string[] };
  'indexnow.submit': { paths: string[] };
  'uploads.cleanup': Record<string, never>;
  'sessions.cleanup': Record<string, never>;
}
export type JobName = keyof JobPayloads;

export const JOB_QUEUE: Record<JobName, QueueName> = {
  'media.process': 'media',
  'video.sync': 'video',
  'notify.telegram': 'notify',
  'notify.email': 'notify',
  'web.revalidate': 'web',
  'indexnow.submit': 'web',
  'uploads.cleanup': 'maintenance',
  'sessions.cleanup': 'maintenance',
};
