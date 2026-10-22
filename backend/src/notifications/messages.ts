import {
  formatKgs,
  formatPhoneDisplay,
  LEAD_KIND_LABELS,
  orderItemLabel,
  QUIZ_QUESTIONS,
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
  lines: { type: 'product' | 'program'; title: string; qty: number }[];
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
  const items = order.lines.map((line) => `${orderItemLabel(line)}${line.qty > 1 ? ` × ${line.qty}` : ''}`);
  const lines = [
    ...(items.length === 1
      ? [`${items[0]} · ${formatKgs(order.totalKgs)}`]
      : [...items.map((item) => `• ${item}`), `Итого: ${formatKgs(order.totalKgs)}`]),
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
    // Leads from before October 2026 hold other answer values; those are skipped instead of printed as "—".
    for (const key of QUIZ_QUESTIONS.map((question) => question.key) as QuizKey[]) {
      const value = lead.answers[key];
      const label = typeof value === 'string' ? quizAnswerLabel(key, value as never) : '—';
      if (label !== '—') lines.push(label);
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
