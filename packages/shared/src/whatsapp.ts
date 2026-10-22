import type { OrderItemType, WholesaleBuyer, WholesaleCountry } from './enums';
import { WHOLESALE_BUYER_LABELS, WHOLESALE_COUNTRY_LABELS } from './labels';
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

/** One bullet per line ("× qty" only above 1), "Итого" for two or more lines (README §7.5). */
export function buildOrderMessage(order: OrderMessageInput): string {
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
  lines.push('', 'Пришлите, пожалуйста, реквизиты для оплаты.');
  return lines.join('\n');
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
