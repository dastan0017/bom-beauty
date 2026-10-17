import type { OrderItemType, WholesaleBuyer, WholesaleCountry } from './enums';
import { WHOLESALE_BUYER_LABELS, WHOLESALE_COUNTRY_LABELS } from './labels';
import { quizAnswerLabel, type QuizAnswers } from './quiz';

// WhatsApp message texts, verbatim from design/Bom Beauty Prototype.dc.html.

export const GENERIC_QUESTION_MESSAGE = 'Здравствуйте! У меня вопрос по уходу.';

/** https://wa.me/996706304803?text=… */
export function waLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function orderItemLabel(item: { type: OrderItemType; title: string }): string {
  return item.type === 'program' ? `Программа «${item.title}»` : item.title;
}

export interface OrderMessageInput {
  item: { type: OrderItemType; title: string };
  qty: number;
  /** Total formatted in the visitor's currency. */
  total: string;
  /** Total in сом, only when the visitor chose another currency. */
  totalKgs?: string;
  name: string;
  phone: string;
  address: string;
  comment?: string;
}

export function buildOrderMessage(order: OrderMessageInput): string {
  const lines = [
    'Здравствуйте! Хочу заказать:',
    `• ${orderItemLabel(order.item)}${order.qty > 1 ? ` × ${order.qty}` : ''} — ${order.total}`,
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

/**
 * Quiz hand-off. `choose` = the visitor asks for help choosing between the suggested programs
 * ("Спросить Нурайым в WhatsApp"); otherwise they ask for a personal review of the top one.
 */
export function buildQuizMessage(
  answers: Partial<QuizAnswers>,
  programTitles: string[],
  choose: boolean,
): string {
  const header = [
    'Здравствуйте, Нурайым! Прошла тест «Выбрать программу за 1 минуту» на сайте.',
    `— Тип кожи: ${quizAnswerLabel('skin', answers.skin)}`,
    `— Задача: ${quizAnswerLabel('goal', answers.goal)}`,
    `— Профессиональная косметика: ${quizAnswerLabel('exp', answers.exp)}`,
  ].join('\n');
  const tail = choose
    ? `Сайт предложил программы: ${programTitles.map((title) => `«${title}»`).join(', ')}. Помогите выбрать, пожалуйста.`
    : `Сайт рекомендовал программу «${programTitles[0] ?? ''}». Хочу получить личный разбор ухода.`;
  return `${header}\n${tail}`;
}

export function buildProtocolRequestMessage(programTitle: string): string {
  return `Здравствуйте, Нурайым! Пришлите, пожалуйста, протокол ухода по программе «${programTitle}».`;
}
