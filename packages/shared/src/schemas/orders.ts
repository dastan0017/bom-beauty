import { z } from 'zod';
import { CURRENCY_CODES } from '../enums';
import { normalizePhone } from '../phone';
import { slugSchema, submissionMetaShape } from './common';

export const orderItemRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('product'), slug: slugSchema }),
  z.object({ type: z.literal('program'), slug: slugSchema }),
]);

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

export const createOrderSchema = z.object({
  ...submissionMetaShape,
  item: orderItemRefSchema,
  qty: z.number().int().min(1).max(9),
  name: z.string().trim().min(2, 'order.name.required').max(80, 'order.name.max'),
  phone: phoneInputSchema,
  address: z.string().trim().min(4, 'order.address.required').max(300, 'order.address.max'),
  comment: z.string().trim().max(500, 'order.comment.max').optional(),
  displayCurrency: z.enum(CURRENCY_CODES).default('KGS'),
  displayRate: z.number().positive().optional(),
  fromQuiz: z.boolean().optional(),
});
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrder = z.output<typeof createOrderSchema>;

export const createOrderResponseSchema = z.object({ id: z.uuid(), number: z.number().int() });
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
