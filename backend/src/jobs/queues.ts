// BullMQ queues and job payloads (docs/API.md §8).

export const QUEUES = {
  media: 'media',
  video: 'video',
  notify: 'notify',
  web: 'web',
  maintenance: 'maintenance',
  payments: 'payments',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Why a payment needs the owner's eyes (docs/finik/SPEC.md §5.7). */
/** Why a payment needs the owner's eyes: another amount, a second payment, a cancelled or deleted order, or a
 * webhook whose Finik account is not ours (or missing), which is never applied automatically. */
export type PaymentReviewReason = 'amount' | 'double' | 'cancelled' | 'deleted' | 'account';

/**
 * What to tell the owner. Orders and leads as before; `event` marks the payment messages: an online order left
 * unpaid, a payment received, a payment to check, the admin's 1 сом connection check, and money for our account that
 * matches no payment the site knows (`paymentEvent`).
 */
export type NotifyTarget =
  | { entity: 'order'; id: string; event?: 'created' | 'unpaid' }
  | { entity: 'lead'; id: string }
  | { entity: 'payment'; id: string; event: 'paid' | 'review' | 'check_paid'; reason?: PaymentReviewReason }
  | { entity: 'paymentEvent'; id: string; event: 'unknown' };

export interface JobPayloads {
  'media.process': { mediaId: string };
  'video.sync': { videoId: string; attempt: number };
  'notify.telegram': NotifyTarget;
  'notify.email': NotifyTarget;
  'web.revalidate': { tags: string[] };
  'indexnow.submit': { paths: string[] };
  'uploads.cleanup': Record<string, never>;
  'sessions.cleanup': Record<string, never>;
  'payments.expire': Record<string, never>;
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
  'payments.expire': 'payments',
};
