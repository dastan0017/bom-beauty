'use client';

// An online order on its way to Finik (docs/finik/SPEC.md §6.3). The cart empties only once the order is paid:
// on the payment page, or on a later visit if the customer never came back from Finik.

const KEY = 'bb-pending-payment';
const MAX_AGE_MS = 7 * 24 * 3_600_000;

export interface PendingPayment {
  /** The order's pay token (its /pay/<token> page). */
  token: string;
  number: number;
  /** The order was the cart, so paying it empties the cart. */
  fromCart: boolean;
  at: number;
}

export function savePendingPayment(record: Omit<PendingPayment, 'at'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...record, at: Date.now() }));
  } catch {
    // Storage unavailable: the cart simply stays as it is.
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<PendingPayment>;
    if (
      typeof record.token !== 'string' ||
      typeof record.at !== 'number' ||
      typeof record.number !== 'number' ||
      Date.now() - record.at > MAX_AGE_MS
    ) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { token: record.token, number: record.number, fromCart: record.fromCart === true, at: record.at };
  } catch {
    return null;
  }
}

export function clearPendingPayment(token?: string): void {
  try {
    if (token && readPendingPayment()?.token !== token) return;
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The token at the end of a pay page URL ("https://bom-beauty.com/pay/<token>"). */
export function tokenOf(page: string): string | null {
  try {
    const match = /^\/pay\/([A-Za-z0-9_-]{16,64})$/.exec(new URL(page).pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
