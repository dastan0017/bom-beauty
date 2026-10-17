'use client';

import type { Utm } from '@bom/shared';

// Order and lead submissions (docs/ARCHITECTURE.md §6.2). WhatsApp opens first, inside the click, so the visitor
// never waits for the API; the record is POSTed with `keepalive` and kept in a localStorage outbox until the API
// confirms it, so a closed tab or a flaky network never loses an order. `clientRef` makes retries idempotent.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const OUTBOX_KEY = 'bb-outbox';
const ATTRIBUTION_KEY = 'bb-attribution';
const OUTBOX_MAX_AGE_MS = 3 * 24 * 3_600_000;

interface Attribution {
  utm?: Utm;
  referrer?: string;
}

interface OutboxEntry {
  path: string;
  body: Record<string, unknown>;
  createdAt: number;
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the submission still goes out once.
  }
}

/** Keeps the first UTM tags and external referrer of the visit (sessionStorage). */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  const current = readJson<Attribution | null>(sessionStorage, ATTRIBUTION_KEY, null);
  if (current) return;
  const params = new URLSearchParams(window.location.search);
  const utm: Utm = {};
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value.slice(0, 200);
  }
  const referrer =
    document.referrer && !document.referrer.startsWith(window.location.origin)
      ? document.referrer.slice(0, 500)
      : undefined;
  writeJson(sessionStorage, ATTRIBUTION_KEY, {
    ...(Object.keys(utm).length ? { utm } : {}),
    ...(referrer ? { referrer } : {}),
  });
}

/** Fields every submission carries besides the form itself. */
export function submissionMeta(message: string): {
  clientRef: string;
  message: string;
  pageUrl: string;
  referrer?: string;
  utm?: Utm;
} {
  const attribution = readJson<Attribution>(sessionStorage, ATTRIBUTION_KEY, {});
  return {
    clientRef: crypto.randomUUID(),
    message,
    pageUrl: window.location.href.slice(0, 500),
    ...attribution,
  };
}

function outbox(): OutboxEntry[] {
  return readJson<OutboxEntry[]>(localStorage, OUTBOX_KEY, []).filter(
    (entry) => Date.now() - entry.createdAt < OUTBOX_MAX_AGE_MS,
  );
}

function removeFromOutbox(clientRef: unknown): void {
  writeJson(
    localStorage,
    OUTBOX_KEY,
    outbox().filter((entry) => entry.body.clientRef !== clientRef),
  );
}

async function send(entry: OutboxEntry): Promise<void> {
  try {
    const response = await fetch(`${API_URL}${entry.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry.body),
      keepalive: true,
    });
    // 4xx means the API will never accept it (validation): retrying would not help.
    if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
      removeFromOutbox(entry.body.clientRef);
    }
  } catch {
    // Network error: stays in the outbox for the next page load.
  }
}

/** Records the submission; never throws and never blocks the WhatsApp hand-off. */
export function submit(
  path: '/orders' | '/leads/quiz' | '/leads/wholesale',
  body: Record<string, unknown>,
): void {
  const entry: OutboxEntry = { path, body, createdAt: Date.now() };
  writeJson(localStorage, OUTBOX_KEY, [...outbox(), entry]);
  void send(entry);
}

/** Resends whatever a previous visit could not deliver. */
export function flushOutbox(): void {
  if (typeof window === 'undefined') return;
  const pending = outbox();
  writeJson(localStorage, OUTBOX_KEY, pending);
  for (const entry of pending) void send(entry);
}

/** Opens WhatsApp in a new tab, falling back to the current one when pop-ups are blocked. */
export function openExternal(url: string): void {
  // With the "noopener" feature window.open always returns null, so the opener is cut by hand instead.
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  else window.location.href = url;
}

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number>) => void };
  }
}

/** Umami custom event; a no-op when analytics is off. */
export function track(event: string, data?: Record<string, string | number>): void {
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the page.
  }
}

/** "14:05" for the message bubble. */
export function clockTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
