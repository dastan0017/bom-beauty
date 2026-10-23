import { z } from '../zod';
import { CURRENCY_CODES, PAYMENT_METHODS } from '../enums';
import { normalizePhone } from '../phone';
import { LINE_QTY_MAX, ORDER_LINES_MAX } from '../limits';
import { slugSchema, submissionMetaShape } from './common';

export const orderItemRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('product'), slug: slugSchema }),
  z.object({ type: z.literal('program'), slug: slugSchema }),
]);

/** One line of an order: a product from the cart, or the program of a direct order. */
export const orderLineInputSchema = z.object({
  type: z.enum(['product', 'program']),
  slug: slugSchema,
  qty: z.number().int().min(1).max(LINE_QTY_MAX),
});
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

/** Phone as typed by the visitor; must normalise to a valid number (+996 by default). */
export const phoneInputSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    // Design rule: fewer than 9 digits means "no number yet"; otherwise it must be a real number.
    if (value.replace(/\D/g, '').length < 9)
      ctx.addIssue({ code: 'custom', message: 'order.phone.required' });
    else if (normalizePhone(value) === null) ctx.addIssue({ code: 'custom', message: 'phone.invalid' });
  });

/** The order form's contact fields (the site validates them before opening WhatsApp). */
export const orderContactSchema = z.object({
  name: z.string().trim().min(2, 'order.name.required').max(80, 'order.name.max'),
  phone: phoneInputSchema,
  address: z.string().trim().min(4, 'order.address.required').max(300, 'order.address.max'),
  comment: z.string().trim().max(500, 'order.comment.max').optional(),
});

export const createOrderSchema = z
  .object({
    ...submissionMetaShape,
    items: z
      .array(orderLineInputSchema)
      .min(1, 'order.items.required')
      .max(ORDER_LINES_MAX, 'order.items.max')
      .optional(),
    /**
     * @deprecated One-item shape sent before October 2026. Still accepted, because browsers may hold such orders in
     * their retry outbox; use `items`.
     */
    item: orderItemRefSchema.optional(),
    /** @deprecated Quantity of `item`. */
    qty: z.number().int().min(1).max(9).optional(),
    ...orderContactSchema.shape,
    displayCurrency: z.enum(CURRENCY_CODES).default('KGS'),
    displayRate: z.number().positive().optional(),
    fromQuiz: z.boolean().optional(),
    /** `finik`: pay online now. Outbox entries from before online payment have none and stay WhatsApp orders. */
    paymentMethod: z.enum(PAYMENT_METHODS).default('whatsapp'),
  })
  .refine((value) => value.items !== undefined || value.item !== undefined, {
    message: 'order.items.required',
    path: ['items'],
  });
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrder = z.output<typeof createOrderSchema>;

/** The order's lines, whichever shape it came in, with repeated items merged (capped at LINE_QTY_MAX). */
export function orderLinesOf(order: Pick<CreateOrder, 'items' | 'item' | 'qty'>): OrderLineInput[] {
  const raw = order.items ?? (order.item ? [{ ...order.item, qty: order.qty ?? 1 }] : []);
  const merged = new Map<string, OrderLineInput>();
  for (const line of raw) {
    const key = `${line.type}:${line.slug}`;
    const seen = merged.get(key);
    merged.set(key, seen ? { ...seen, qty: Math.min(LINE_QTY_MAX, seen.qty + line.qty) } : { ...line });
  }
  return [...merged.values()];
}

/** Where an online order goes next: Finik's page now, or our payment page when Finik did not answer. */
export const orderPaymentStartSchema = z.object({
  /** Finik's payment page; null when Finik refused or timed out (the site then opens `page`). */
  url: z.url().nullable(),
  /** The order's own payment page on the site, `/pay/<token>`. */
  page: z.url(),
});
export type OrderPaymentStart = z.infer<typeof orderPaymentStartSchema>;

export const createOrderResponseSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  /** Null for WhatsApp orders. */
  payment: orderPaymentStartSchema.nullable(),
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
