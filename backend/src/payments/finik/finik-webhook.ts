import type { KeyObject } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { z } from 'zod';
import { canonicalString, verifyCanonical } from './finik-signer';

// Verifying Finik's payment webhook (docs/finik/SPEC.md §2.6, §5.7). The signature covers the body exactly as Finik
// built it, so it is checked on the raw bytes parsed with JSON.parse, never on a zod-parsed copy (zod rebuilds
// objects in schema order and drops keys). Only after that does the payload go through a schema.

const MAX_SKEW_MS = 5 * 60_000;

export type WebhookCheck =
  { ok: true; body: Record<string, unknown> } | { ok: false; status: 400 | 401; reason: string };

export function verifyFinikWebhook(input: {
  rawBody: Buffer | undefined;
  headers: IncomingHttpHeaders;
  /** Host and path Finik may have signed: our configured webhook URL first, then the request as received. */
  candidates: { host: string; path: string }[];
  publicKey: KeyObject;
  now: number;
}): WebhookCheck {
  if (!input.rawBody?.length) return { ok: false, status: 400, reason: 'empty body' };
  let body: unknown;
  try {
    body = JSON.parse(input.rawBody.toString('utf8'));
  } catch {
    return { ok: false, status: 400, reason: 'body is not JSON' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, reason: 'body is not an object' };
  }

  const signature = single(input.headers.signature);
  const timestamp = single(input.headers['x-api-timestamp']);
  if (!signature || !timestamp) return { ok: false, status: 401, reason: 'unsigned' };

  const apiHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers)) {
    const text = single(value);
    if (name.toLowerCase().startsWith('x-api-') && text !== undefined) apiHeaders[name.toLowerCase()] = text;
  }
  const record = body as Record<string, unknown>;
  const valid = input.candidates.some((candidate) =>
    verifyCanonical(
      canonicalString({
        method: 'POST',
        path: candidate.path,
        host: candidate.host,
        headers: apiHeaders,
        body: record,
      }),
      signature,
      input.publicKey,
    ),
  );
  if (!valid) return { ok: false, status: 401, reason: 'bad signature' };

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(input.now - sentAt) > MAX_SKEW_MS) {
    return { ok: false, status: 401, reason: 'stale timestamp' };
  }
  return { ok: true, body: record };
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

// Finik sends some ids as numbers. Anything that is neither text nor a finite number counts as missing, so one odd
// field never discards the whole event (a missing amount then fails the amount check instead).
const text = z.preprocess(
  (value) =>
    typeof value === 'number' || (typeof value === 'string' && value !== '') ? String(value) : undefined,
  z.string().optional(),
);
const number = z.preprocess((value) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}, z.number().optional());

/** The fields we use; everything else in the payload is ignored (and never stored: it may hold the payer's name). */
export const finikWebhookSchema = z.object({
  id: text,
  transactionId: text,
  status: text,
  amount: number,
  requestDate: number,
  transactionDate: number,
  receiptNumber: text,
  transactionType: text,
  /** Merchant account; some payloads carry it at the top level. */
  accountId: text,
  fields: z.object({ paymentId: text }).optional().catch(undefined),
  /** Echo of the `Data` we sent when creating the payment: the account it pays into and our description. */
  data: z.object({ accountId: text, description: text }).optional().catch(undefined),
  service: z.object({ id: text }).optional().catch(undefined),
  item: z.object({ id: text }).optional().catch(undefined),
});
export type FinikWebhook = z.infer<typeof finikWebhookSchema>;

/** Paid, failed or something we do not act on; Finik's casing varies ("success", "succeeded", "SUCCEEDED"). */
export function webhookOutcome(status: string | undefined): 'paid' | 'failed' | 'other' {
  const value = status?.toLowerCase();
  if (value === 'success' || value === 'succeeded') return 'paid';
  if (value === 'failed') return 'failed';
  return 'other';
}

/** The Finik account the payment went to: the echo of our `Data.accountId`, else a top-level `accountId`. */
export const webhookAccount = (event: FinikWebhook): string | undefined =>
  event.data?.accountId ?? event.accountId;

/** Whitelisted, non-personal copy of the payload for `payment_events.data`. */
export function webhookRecord(event: FinikWebhook): Record<string, string | number> {
  const entries: [string, string | number | undefined][] = [
    ['id', event.id],
    ['transactionId', event.transactionId],
    ['status', event.status],
    ['amount', event.amount],
    ['requestDate', event.requestDate],
    ['transactionDate', event.transactionDate],
    ['receiptNumber', event.receiptNumber],
    ['transactionType', event.transactionType],
    ['serviceId', event.service?.id],
    ['itemId', event.item?.id],
    ['paymentId', event.fields?.paymentId],
    ['accountId', webhookAccount(event)],
    ['description', event.data?.description],
  ];
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string | number] => entry[1] !== undefined),
  );
}
