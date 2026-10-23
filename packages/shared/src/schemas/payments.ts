import { z } from '../zod';
import {
  ORDER_ITEM_TYPES,
  ORDER_PAYMENT_STATUSES,
  PAYMENT_CHANNELS,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
  PAYMENT_STATUSES,
} from '../enums';

// Online payment through Finik (docs/finik/SPEC.md). Public shapes carry no personal data.

/** The random part of `/pay/<token>`: 32 hex characters (a v4 UUID, 122 random bits); the pattern leaves room. */
export const payTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, 'pay.token.invalid');

export const PAY_PAGE_STATUSES = ['unpaid', 'pending', 'paid', 'refunded', 'cancelled'] as const;
export type PayPageStatus = (typeof PAY_PAGE_STATUSES)[number];

/** `GET /pay/:token`: what the payment page shows. */
export const payPageSchema = z.object({
  number: z.number().int(),
  lines: z.array(
    z.object({
      type: z.enum(ORDER_ITEM_TYPES),
      title: z.string(),
      qty: z.number().int(),
      totalKgs: z.number().int(),
    }),
  ),
  /** Sum of the lines. */
  totalKgs: z.number().int(),
  /** Set by the owner while the order is unpaid (delivery, discount, an added item); may be negative. */
  adjustmentKgs: z.number().int(),
  adjustmentNote: z.string().nullable(),
  /** What the customer pays: totalKgs + adjustmentKgs. */
  amountKgs: z.number().int(),
  /** `pending`: a payment link is live, the customer may be paying right now. */
  status: z.enum(PAY_PAGE_STATUSES),
  paidAt: z.iso.datetime().nullable(),
  /** Online payment is on and the order can still be paid. */
  canPay: z.boolean(),
});
export type PayPage = z.infer<typeof payPageSchema>;

/** `POST /pay/:token`: Finik's payment page for the current amount. */
export const payStartSchema = z.object({ url: z.url() });
export type PayStart = z.infer<typeof payStartSchema>;

/** One attempt in the admin's order drawer. */
export const paymentAttemptSchema = z.object({
  id: z.uuid(),
  purpose: z.enum(PAYMENT_PURPOSES),
  status: z.enum(PAYMENT_STATUSES),
  amountKgs: z.number().int(),
  channel: z.enum(PAYMENT_CHANNELS).nullable(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  /** What Finik reported, in сом (may have decimals). */
  paidAmountKgs: z.number().nullable(),
  transactionId: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  error: z.string().nullable(),
});
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;

/** Payment block of the admin's order detail. */
export const orderPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(ORDER_PAYMENT_STATUSES),
  paidAt: z.iso.datetime().nullable(),
  adjustmentKgs: z.number().int(),
  adjustmentNote: z.string().nullable(),
  amountKgs: z.number().int(),
  /** The order's payment page; null while online payment is off. */
  payUrl: z.url().nullable(),
  /** WhatsApp text with the payment link, ready for the customer; null while online payment is off. */
  linkMessage: z.string().nullable(),
  attempts: z.array(paymentAttemptSchema),
});
export type OrderPayment = z.infer<typeof orderPaymentSchema>;

export const FINIK_ENVIRONMENTS = ['mock', 'beta', 'prod'] as const;
export type FinikEnvironment = (typeof FINIK_ENVIRONMENTS)[number];

/** `GET /admin/payments/finik`: connection state for «Настройки → Оплата». */
export const finikStatusSchema = z.object({
  configured: z.boolean(),
  environment: z.enum(FINIK_ENVIRONMENTS).nullable(),
  /** Masked: "ff99…ec89". */
  accountId: z.string().nullable(),
  webhookUrl: z.string().nullable(),
});
export type FinikStatus = z.infer<typeof finikStatusSchema>;

/** `POST /admin/payments/finik/check` and `GET /admin/payments/:id`: the 1 сом connection check. */
export const paymentCheckSchema = z.object({
  id: z.uuid(),
  status: z.enum(PAYMENT_STATUSES),
  /** Finik's page to pay the check; null when Finik refused. */
  url: z.url().nullable(),
  error: z.string().nullable(),
  paidAt: z.iso.datetime().nullable(),
});
export type PaymentCheck = z.infer<typeof paymentCheckSchema>;
