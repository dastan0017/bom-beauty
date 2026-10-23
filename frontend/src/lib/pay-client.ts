'use client';

import {
  createOrderResponseSchema,
  payPageSchema,
  payStartSchema,
  type CreateOrderResponse,
  type PayPage,
} from '@bom/shared/forms';

// Browser calls of online payment (docs/finik/SPEC.md §6). Unlike WhatsApp orders, an online order is awaited: the
// customer goes on to Finik only with the order stored and its payment link in hand.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const ORDER_TIMEOUT_MS = 25_000;

/** What went wrong, for the sheet and the pay page to explain. */
export type PayFailure =
  | { kind: 'network' }
  | {
      kind: 'api';
      status: number;
      code: string | null;
      message: string | null;
      fields: Record<string, string>;
    };

export type Result<T> = { ok: true; value: T } | { ok: false; failure: PayFailure };

async function call<T>(
  path: string,
  init: RequestInit,
  parse: (json: unknown) => T,
  timeoutMs = 15_000,
): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, failure: { kind: 'network' } };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (json as { error?: { code?: unknown; message?: unknown; fields?: unknown } } | null)?.error;
    return {
      ok: false,
      failure: {
        kind: 'api',
        status: response.status,
        code: typeof error?.code === 'string' ? error.code : null,
        message: typeof error?.message === 'string' ? error.message : null,
        fields:
          error?.fields && typeof error.fields === 'object' ? (error.fields as Record<string, string>) : {},
      },
    };
  }
  try {
    return { ok: true, value: parse(json) };
  } catch {
    return { ok: false, failure: { kind: 'network' } };
  }
}

/** POST /orders for an online order; the same body (same clientRef) may be sent again after a network error. */
export function createOnlineOrder(body: Record<string, unknown>): Promise<Result<CreateOrderResponse>> {
  return call(
    '/orders',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    (json) => createOrderResponseSchema.parse(json),
    ORDER_TIMEOUT_MS,
  );
}

/** The payment page's state; `null` when the order is gone. */
export async function fetchPayPage(token: string): Promise<Result<PayPage | null>> {
  const result = await call(`/pay/${token}`, { method: 'GET' }, (json) => payPageSchema.parse(json));
  if (!result.ok && result.failure.kind === 'api' && result.failure.status === 404)
    return { ok: true, value: null };
  return result;
}

/** Finik's page for the order's current amount. */
export function startPayment(token: string): Promise<Result<string>> {
  return call(`/pay/${token}`, { method: 'POST' }, (json) => payStartSchema.parse(json).url);
}
