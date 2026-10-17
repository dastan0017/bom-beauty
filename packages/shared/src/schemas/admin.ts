import { z } from 'zod';
import { LEAD_KINDS, ORDER_ITEM_TYPES, ORDER_STATUSES } from '../enums';
import { utmSchema } from './common';

// Admin endpoints for orders, leads, customers and the overview (docs/API.md §6).

/** Cursor pagination: `cursor` is the id of the last row seen (UUIDv7, so ids sort by time). */
const pageQuery = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};

const isoDate = z.iso.date();

export const orderRowSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  name: z.string(),
  phone: z.string(),
  itemTitle: z.string(),
  itemType: z.enum(ORDER_ITEM_TYPES),
  qty: z.number().int(),
  address: z.string(),
  /** First part of the address ("Бишкек"), for the city column. */
  city: z.string(),
  totalKgs: z.number().int(),
  status: z.enum(ORDER_STATUSES),
  createdAt: z.iso.datetime(),
});
export type OrderRow = z.infer<typeof orderRowSchema>;

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  /** Name, phone digits, item title or order number ("1041" or "#1041"). */
  q: z.string().trim().max(100).optional(),
  /** Inclusive dates in Asia/Bishkek. */
  from: isoDate.optional(),
  to: isoDate.optional(),
  ...pageQuery,
});
export type OrderListQuery = z.input<typeof orderListQuerySchema>;

export const orderListSchema = z.object({ items: z.array(orderRowSchema), nextCursor: z.uuid().nullable() });
export type OrderList = z.infer<typeof orderListSchema>;

export const orderCountersSchema = z.object({
  all: z.number().int(),
  new: z.number().int(),
  sent: z.number().int(),
  cancelled: z.number().int(),
});
export type OrderCounters = z.infer<typeof orderCountersSchema>;

export const orderHistoryEntrySchema = z.object({
  at: z.iso.datetime(),
  action: z.string(),
  from: z.enum(ORDER_STATUSES).nullable(),
  to: z.enum(ORDER_STATUSES).nullable(),
  userName: z.string().nullable(),
});

export const orderDetailSchema = orderRowSchema.extend({
  unitPriceKgs: z.number().int(),
  comment: z.string().nullable(),
  message: z.string(),
  note: z.string(),
  displayCurrency: z.string(),
  displayRate: z.number().nullable(),
  fromQuiz: z.boolean(),
  pageUrl: z.string().nullable(),
  referrer: z.string().nullable(),
  utm: utmSchema.nullable(),
  statusChangedAt: z.iso.datetime(),
  history: z.array(orderHistoryEntrySchema),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const updateOrderSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    note: z.string().trim().max(2000, 'order.note.max').optional(),
  })
  .refine((value) => value.status !== undefined || value.note !== undefined, 'order.update.empty');
export type UpdateOrder = z.infer<typeof updateOrderSchema>;

export const leadListQuerySchema = z.object({ kind: z.enum(LEAD_KINDS).optional(), ...pageQuery });
export type LeadListQuery = z.input<typeof leadListQuerySchema>;

export const leadRowSchema = z.object({
  id: z.uuid(),
  kind: z.enum(LEAD_KINDS),
  /** Raw answers: quiz `{ skin, goal, exp, fmt }` or wholesale `{ buyer?, country? }`. */
  answers: z.record(z.string(), z.string()),
  recommended: z.array(z.object({ slug: z.string(), title: z.string() })),
  choose: z.boolean(),
  message: z.string(),
  pageUrl: z.string().nullable(),
  utm: utmSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type LeadRow = z.infer<typeof leadRowSchema>;

export const leadListSchema = z.object({
  items: z.array(leadRowSchema),
  nextCursor: z.uuid().nullable(),
  counts: z.object({ all: z.number().int(), quiz: z.number().int(), wholesale: z.number().int() }),
});
export type LeadList = z.infer<typeof leadListSchema>;

export const customerQuerySchema = z.object({ q: z.string().trim().max(100).optional() });

export const customerSchema = z.object({
  name: z.string(),
  phone: z.string(),
  city: z.string(),
  count: z.number().int(),
  totalKgs: z.number().int(),
  lastOrderAt: z.iso.datetime(),
  /** Most frequent item ("Чаще заказывает"). */
  favorite: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;

export const DASHBOARD_PERIODS = ['today', 'week', 'month'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const dashboardQuerySchema = z.object({ period: z.enum(DASHBOARD_PERIODS).default('today') });

export const dashboardSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS),
  cards: z.object({
    /** Orders created in the period (all statuses). */
    orders: z.number().int(),
    /** Orders in the previous period of the same length (yesterday for "today"). */
    previousOrders: z.number().int(),
    /** Status "new", any date. */
    awaiting: z.number().int(),
    /** Sum and average of the period's orders that were not cancelled. */
    sumKgs: z.number().int(),
    avgKgs: z.number().int(),
    cancelled: z.number().int(),
    /** Cancelled in the last 7 days (shown on "today"). */
    cancelledWeek: z.number().int(),
  }),
  recent: z.array(orderRowSchema),
  /** Program orders in the last 7 days, most ordered first. */
  byProgram: z.array(z.object({ title: z.string(), count: z.number().int() })),
  programOrdersTotal: z.number().int(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

/** City shown for an order: the first comma-separated part of the address. */
export function cityOf(address: string): string {
  return (address.split(',')[0] ?? '').trim().slice(0, 60);
}
