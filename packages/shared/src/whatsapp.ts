import type { OrderItemType, WholesaleBuyer, WholesaleCountry } from './enums';
import { WHOLESALE_BUYER_LABELS, WHOLESALE_COUNTRY_LABELS } from './labels';
import { formatKgs } from './money';
import { quizAnswerLabel, type QuizAnswers } from './quiz';

// WhatsApp message texts, verbatim from design/Bom Beauty Prototype.dc.html.

export const GENERIC_QUESTION_MESSAGE = 'Здравствуйте! У меня вопрос по уходу.';

/** The shop's number until the owner changes it in the admin (default of `settings.shop.whatsapp`). */
export const DEFAULT_SHOP_WHATSAPP = '+996706304803';

/** https://wa.me/996706304803?text=… */
export function waLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function orderItemLabel(item: { type: OrderItemType; title: string }): string {
  return item.type === 'program' ? `Программа «${item.title}»` : item.title;
}

export interface OrderMessageLine {
  type: OrderItemType;
  title: string;
  qty: number;
  /** Line total formatted in the visitor's currency. */
  total: string;
}

export interface OrderMessageInput {
  lines: OrderMessageLine[];
  /** Order total formatted in the visitor's currency; shown when there are two or more lines. */
  total: string;
  /** Order total in сом, only when the visitor chose another currency. */
  totalKgs?: string;
  name: string;
  phone: string;
  address: string;
  comment?: string;
}

export interface OrderMessageOptions {
  /** `online`: the stored record of an order paid online (it is never sent to WhatsApp). */
  closing?: 'details' | 'online';
  /** Adds "Номер заказа на сайте: №1042", for the WhatsApp fallback after a failed online payment. */
  number?: number;
}

/** One bullet per line ("× qty" only above 1), "Итого" for two or more lines (README §7.5). */
export function buildOrderMessage(order: OrderMessageInput, options: OrderMessageOptions = {}): string {
  const lines = [
    'Здравствуйте! Хочу заказать:',
    ...order.lines.map(
      (line) => `• ${orderItemLabel(line)}${line.qty > 1 ? ` × ${line.qty}` : ''} — ${line.total}`,
    ),
    ...(order.lines.length > 1 ? [`Итого: ${order.total}`] : []),
    '',
    `Имя: ${order.name.trim()}`,
    `Телефон: ${order.phone.trim()}`,
    `Адрес: ${order.address.trim()}`,
  ];
  const comment = order.comment?.trim();
  if (comment) lines.push(`Комментарий: ${comment}`);
  if (order.totalKgs) lines.push(`Сумма в сомах: ${order.totalKgs}`);
  if (options.number) lines.push(`Номер заказа на сайте: №${options.number}`);
  lines.push(
    '',
    options.closing === 'online'
      ? 'Оплата онлайн через Finik.'
      : 'Пришлите, пожалуйста, реквизиты для оплаты.',
  );
  return lines.join('\n');
}

// Texts the owner sends to customers from the Telegram bot (docs/finik/SPEC.md §0). Ours, so no em-dashes. The owner
// can rewrite them in «Настройки → Оплата»; these are the defaults. Delivery times abroad are hers to fill in.

/** Placeholders the owner can use in her templates; `{состав}` is what was ordered (buildOrderItemsText). */
export const WHATSAPP_PLACEHOLDERS = [
  '{имя}',
  '{заказ}',
  '{состав}',
  '{сумма}',
  '{адрес}',
  '{ссылка}',
] as const;

export const DEFAULT_WHATSAPP_TEMPLATES = {
  /** Payment link for an unpaid order. */
  link: 'Здравствуйте, {имя}! Ваш заказ №{заказ}:\n{состав}\n\nК оплате: {сумма}\nОплатить можно по ссылке: {ссылка}',
  /** Paid, delivery within Kyrgyzstan (phone +996). */
  paidLocal:
    'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸\n\nВ заказе:\n{состав}\nОплачено: {сумма}\n\nДоставим по адресу: {адрес}. Когда вам удобно принять заказ?',
  /** Paid, delivery abroad (any other phone). */
  paidAbroad:
    'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸\n\nВ заказе:\n{состав}\nОплачено: {сумма}\n\nОтправим заказ в течение [...] дней, трек-номер пришлём сюда.',
} as const;
export type WhatsappTemplateKey = keyof typeof DEFAULT_WHATSAPP_TEMPLATES;

/** The first defaults (2026-10-23, before `{состав}`): a saved template still equal to one of them reads as today's. */
const FIRST_WHATSAPP_TEMPLATES: Record<WhatsappTemplateKey, string> = {
  link: 'Здравствуйте, {имя}! Ваш заказ №{заказ} на {сумма}. Оплатить можно по ссылке: {ссылка}',
  paidLocal:
    'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸 Доставим по адресу: {адрес}. Когда вам удобно принять заказ?',
  paidAbroad:
    'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸 Отправим заказ в течение [...] дней, трек-номер пришлём сюда.',
};

/** Saved templates nobody edited move to the current defaults; the owner's own wording stays as she wrote it. */
export function upgradeWhatsappTemplates(
  templates: Record<WhatsappTemplateKey, string>,
): Record<WhatsappTemplateKey, string> {
  const keys = Object.keys(DEFAULT_WHATSAPP_TEMPLATES) as WhatsappTemplateKey[];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      templates[key] === FIRST_WHATSAPP_TEMPLATES[key] ? DEFAULT_WHATSAPP_TEMPLATES[key] : templates[key],
    ]),
  ) as Record<WhatsappTemplateKey, string>;
}

export interface OrderItemsInput {
  lines: { type: OrderItemType; title: string; qty: number; totalKgs: number }[];
  adjustmentKgs?: number;
  adjustmentNote?: string | null;
}

/** One order line with its quantity (always, even 1) and line total in сом: «Cica-сыворотка × 2 · 3 800 сом». */
export function orderLineText(line: {
  type: OrderItemType;
  title: string;
  qty: number;
  totalKgs: number;
}): string {
  return `${orderItemLabel(line)} × ${line.qty} · ${formatKgs(line.totalKgs)}`;
}

/**
 * `{состав}`: one line per item with quantity and price in сом, then the owner's adjustment (delivery, discount):
 * «• Программа «Акне и постакне» × 1 · 5 900 сом», «• Cica-сыворотка × 2 · 3 800 сом», «• Доставка: +300 сом».
 */
export function buildOrderItemsText(order: OrderItemsInput): string {
  const items = order.lines.map((line) => `• ${orderLineText(line)}`);
  const adjustment = order.adjustmentKgs ?? 0;
  if (adjustment) {
    const sign = adjustment > 0 ? '+' : '−';
    items.push(
      `• ${order.adjustmentNote?.trim() || 'Корректировка'}: ${sign}${formatKgs(Math.abs(adjustment))}`,
    );
  }
  return items.join('\n');
}

export interface WhatsappTemplateValues {
  name: string;
  number: number;
  /** What was ordered, from buildOrderItemsText. */
  items: string;
  /** Formatted amount due, "5 900 сом". */
  total: string;
  address: string;
  link?: string;
}

/** Fills the placeholders; anything else in the template stays as the owner wrote it. */
export function renderWhatsappTemplate(template: string, values: WhatsappTemplateValues): string {
  return template
    .replaceAll('{имя}', values.name.trim())
    .replaceAll('{заказ}', String(values.number))
    .replaceAll('{состав}', values.items)
    .replaceAll('{сумма}', values.total)
    .replaceAll('{адрес}', values.address.trim())
    .replaceAll('{ссылка}', values.link ?? '')
    .trim();
}

/** Which "paid" template fits the customer: a Kyrgyz number means delivery within Kyrgyzstan. */
export function paidTemplateFor(phoneE164: string): 'paidLocal' | 'paidAbroad' {
  return phoneE164.startsWith('+996') ? 'paidLocal' : 'paidAbroad';
}

/** «Написать Нурайым» on the payment page once the order is paid. */
export function buildPaidMessage(order: { number: number; total: string }): string {
  return `Здравствуйте! Заказ №${order.number} на сайте оплачен: ${order.total}.`;
}

/** «Написать Нурайым» on the payment page when the payment has not been confirmed. */
export function buildPaymentHelpMessage(order: { number: number }): string {
  return `Здравствуйте! По заказу №${order.number} на сайте оплата не подтвердилась. Проверьте, пожалуйста.`;
}

/** «Написать Нурайым» on the payment page of an order that is not waiting for a payment check. */
export function buildOrderQuestionMessage(order: { number: number }): string {
  return `Здравствуйте! У меня вопрос по заказу №${order.number} на сайте.`;
}

export function buildWholesaleMessage(choice: {
  buyer?: WholesaleBuyer;
  country?: WholesaleCountry;
}): string {
  const lines = ['Здравствуйте, Нурайым! Хочу получить оптовый прайс и консультацию.'];
  const buyer = choice.buyer ? WHOLESALE_BUYER_LABELS[choice.buyer].phrase : undefined;
  const destination = choice.country ? WHOLESALE_COUNTRY_LABELS[choice.country].destination : undefined;
  if (buyer) lines.push('', `${buyer}${destination ? `, доставка в ${destination}` : ''}.`);
  else if (destination) lines.push('', `Доставка в ${destination}.`);
  return lines.join('\n');
}

/** Quiz hand-off from "Спросить Нурайым в WhatsApp" under the result list (README §2). */
export function buildQuizMessage(
  answers: Partial<QuizAnswers>,
  offers: { title: string; price: string }[],
): string {
  return [
    'Здравствуйте, Нурайым! Прошла тест «Подобрать программу ухода за 1 минуту» на сайте.',
    `— Задача: ${quizAnswerLabel('goal', answers.goal)}`,
    `— Кожа через 2–3 часа после умывания: ${quizAnswerLabel('skin', answers.skin)}`,
    `— Активная косметика: ${quizAnswerLabel('exp', answers.exp)}`,
    `— Возраст: ${quizAnswerLabel('age', answers.age)}`,
    `Сайт предложил: ${offers.map((offer) => `«${offer.title}», ${offer.price}`).join('; ')}. Помогите выбрать, пожалуйста.`,
  ].join('\n');
}

/** Fallback when the care scheme PDF fails to open (README §4). */
export function buildSchemeRequestMessage(programTitle: string): string {
  return `Здравствуйте, Нурайым! Пришлите, пожалуйста, схему ухода по программе «${programTitle}».`;
}
