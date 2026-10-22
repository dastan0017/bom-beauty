import { orderKindLabel, orderSummary, type OrderRow } from '@bom/shared';
import { copy } from '@/content/copy';
import { ApiError } from './api';

/** "Cica-сыворотка × 2", or "… и ещё 2" for a cart (design: order item column). */
export function itemLabel(order: Pick<OrderRow, 'lines'>): string {
  return orderSummary(order.lines);
}

/** "Программа", "Товар" or "Корзина · 3 товара" under the item. */
export function kindLabel(order: Pick<OrderRow, 'lines'>): string {
  return orderKindLabel(order.lines);
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
