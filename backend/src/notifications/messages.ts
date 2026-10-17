import {
  formatKgs,
  formatPhoneDisplay,
  LEAD_KIND_LABELS,
  quizAnswerLabel,
  WHOLESALE_BUYER_LABELS,
  WHOLESALE_COUNTRY_LABELS,
  type QuizKey,
  type WholesaleBuyer,
  type WholesaleCountry,
} from '@bom/shared';

// Notification texts (ours, so no em-dashes). Telegram uses HTML parse mode; everything user-typed is escaped.

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface OrderForMessage {
  id: string;
  number: number;
  itemTitle: string;
  itemType: 'product' | 'program';
  qty: number;
  totalKgs: number;
  name: string;
  phone: string;
  address: string;
  comment: string | null;
  fromQuiz: boolean;
}

export function orderMessage(
  order: OrderForMessage,
  adminOrigin: string,
): { html: string; text: string; subject: string } {
  const item = `${order.itemType === 'program' ? `Программа «${order.itemTitle}»` : order.itemTitle}${order.qty > 1 ? ` × ${order.qty}` : ''}`;
  const lines = [
    `${item} · ${formatKgs(order.totalKgs)}`,
    `${order.name} · ${formatPhoneDisplay(order.phone)}`,
    order.address,
    ...(order.comment ? [`Комментарий: ${order.comment}`] : []),
    ...(order.fromQuiz ? ['Пришла из теста'] : []),
  ];
  const link = `${adminOrigin}/orders/${order.id}`;
  const subject = `Новый заказ №${order.number}`;
  return {
    subject,
    html: [
      `<b>${escapeHtml(subject)}</b>`,
      ...lines.map(escapeHtml),
      '',
      `<a href="${link}">Открыть в админке</a>`,
    ].join('\n'),
    text: [subject, ...lines, '', `Открыть в админке: ${link}`].join('\n'),
  };
}

export interface LeadForMessage {
  kind: 'quiz' | 'wholesale';
  answers: Record<string, unknown>;
  recommendedTitles: string[];
  choose: boolean;
}

export function leadMessage(
  lead: LeadForMessage,
  adminOrigin: string,
): { html: string; text: string; subject: string } {
  const subject = `Новая заявка: ${LEAD_KIND_LABELS[lead.kind].toLowerCase()}`;
  const lines: string[] = [];
  if (lead.kind === 'quiz') {
    for (const key of ['skin', 'goal', 'exp', 'fmt'] as QuizKey[]) {
      const value = lead.answers[key];
      if (typeof value === 'string') lines.push(quizAnswerLabel(key, value as never));
    }
    if (lead.recommendedTitles.length)
      lines.push(`Подобрано: ${lead.recommendedTitles.map((t) => `«${t}»`).join(', ')}`);
    lines.push(lead.choose ? 'Просит помочь выбрать' : 'Хочет разбор ухода');
  } else {
    const buyer = lead.answers.buyer as WholesaleBuyer | undefined;
    const country = lead.answers.country as WholesaleCountry | undefined;
    if (buyer && WHOLESALE_BUYER_LABELS[buyer]) lines.push(WHOLESALE_BUYER_LABELS[buyer].label);
    if (country && WHOLESALE_COUNTRY_LABELS[country]) lines.push(WHOLESALE_COUNTRY_LABELS[country].label);
  }
  lines.push('Клиент пишет в WhatsApp');
  const link = `${adminOrigin}/leads`;
  return {
    subject,
    html: [
      `<b>${escapeHtml(subject)}</b>`,
      ...lines.map(escapeHtml),
      '',
      `<a href="${link}">Все заявки</a>`,
    ].join('\n'),
    text: [subject, ...lines, '', `Все заявки: ${link}`].join('\n'),
  };
}
