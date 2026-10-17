import type { OrderRow } from '@bom/shared';
import { copy } from '@/content/copy';
import { ApiError } from './api';

/** "Cica-сыворотка × 2" (design: order item column). */
export function itemLabel(order: Pick<OrderRow, 'itemTitle' | 'qty'>): string {
  return order.qty > 1 ? `${order.itemTitle} × ${order.qty}` : order.itemTitle;
}

/** Toast text for a failed request. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return copy.errors.forbidden;
  if (error instanceof ApiError && error.status === 401) return copy.errors.session;
  if (error instanceof ApiError) {
    const code = Object.values(error.fields)[0];
    if (code) return copy.validation[code] ?? copy.editor.invalid;
  }
  return copy.errors.generic;
}

/** Field → message for the form, from an API validation or conflict error. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(
    Object.entries(error.fields).map(([field, code]) => [
      field,
      copy.validation[code] ?? copy.editor.invalid,
    ]),
  );
}
