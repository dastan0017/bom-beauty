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
  waLink,
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

// ───────────── Online payment (docs/finik/SPEC.md §0) ─────────────
// Every message about a customer ends with the WhatsApp text the button sends, so the owner sees what goes out.

/** A Telegram inline URL button (one per row). */
export interface MessageButton {
  text: string;
  url: string;
}

export interface OutgoingMessage {
  subject: string;
  html: string;
  text: string;
  buttons: MessageButton[];
}

export interface PaymentOrderForMessage {
  id: string;
  number: number;
  lines: { type: 'product' | 'program'; title: string; qty: number }[];
  totalKgs: number;
  adjustmentKgs: number;
  adjustmentNote: string | null;
  name: string;
  phone: string;
  address: string;
  comment: string | null;
  fromQuiz: boolean;
}

/** The customer-facing part: the prepared WhatsApp text and the label of the button that sends it. */
export interface CustomerText {
  whatsappText: string;
  button: string;
}

const signed = (kgs: number): string => `${kgs > 0 ? '+' : '−'}${formatKgs(Math.abs(kgs))}`;

/** Lines, total (and the owner's adjustment), customer, address, comment: shared by every order message. */
function orderBlock(order: PaymentOrderForMessage): string[] {
  const items = order.lines.map((line) => `• ${orderItemLabel(line)}${line.qty > 1 ? ` × ${line.qty}` : ''}`);
  const amount = order.totalKgs + order.adjustmentKgs;
  return [
    ...items,
    `Итого: ${formatKgs(order.totalKgs)}`,
    ...(order.adjustmentKgs
      ? [
          `${order.adjustmentNote?.trim() || 'Корректировка'}: ${signed(order.adjustmentKgs)}`,
          `К оплате: ${formatKgs(amount)}`,
        ]
      : []),
    '',
    `${order.name} · ${formatPhoneDisplay(order.phone)}`,
    order.address,
    ...(order.comment ? [`Комментарий: ${order.comment}`] : []),
    ...(order.fromQuiz ? ['Пришла из теста'] : []),
  ];
}

const adminUrl = (adminOrigin: string, orderId: string) => `${adminOrigin}/orders/${orderId}`;

/**
 * Assembles HTML (Telegram), plain text (email) and buttons. Telegram refuses buttons with non-public URLs, so the
 * admin link becomes a button only on https; otherwise it stays a text link, as in the new-order message.
 */
function compose(input: {
  subject: string;
  header: string;
  body: string[];
  customer?: CustomerText & { phone: string };
  orderId?: string | null;
  adminOrigin: string;
}): OutgoingMessage {
  const buttons: MessageButton[] = [];
  const html = [`<b>${escapeHtml(input.header)}</b>`, ...input.body.map(escapeHtml)];
  const text = [input.header, ...input.body];
  if (input.customer) {
    const url = waLink(input.customer.phone, input.customer.whatsappText);
    buttons.push({ text: input.customer.button, url });
    html.push(
      '',
      `<blockquote><b>Клиент получит в WhatsApp:</b>\n${escapeHtml(input.customer.whatsappText)}</blockquote>`,
    );
    text.push('', 'Клиент получит в WhatsApp:', input.customer.whatsappText, '', `Отправить: ${url}`);
  }
  if (input.orderId) {
    const link = adminUrl(input.adminOrigin, input.orderId);
    if (input.adminOrigin.startsWith('https://')) buttons.push({ text: 'Открыть в админке', url: link });
    else html.push('', `<a href="${link}">Открыть в админке</a>`);
    text.push(`Открыть в админке: ${link}`);
  }
  return { subject: input.subject, html: html.join('\n'), text: text.join('\n'), buttons };
}

/** A WhatsApp order while online payment is on: the payment link is ready to send. */
export function whatsappOrderMessage(
  order: PaymentOrderForMessage,
  customer: CustomerText,
  adminOrigin: string,
): OutgoingMessage {
  return compose({
    subject: `Новый заказ №${order.number}`,
    header: `🛍 Заказ №${order.number} · через WhatsApp · не оплачен`,
    body: orderBlock(order),
    customer: { ...customer, phone: order.phone },
    orderId: order.id,
    adminOrigin,
  });
}

/** Paid (online or by the link): the delivery text is ready to send. */
export function paidMessage(
  order: PaymentOrderForMessage,
  payment: { amountKgs: number; channel: string | null },
  customer: CustomerText,
  adminOrigin: string,
): OutgoingMessage {
  const channel = payment.channel === 'visa' ? 'Visa' : 'QR-код';
  const abroad = !order.phone.startsWith('+996');
  return compose({
    subject: `Заказ №${order.number} оплачен`,
    header: `✅ Заказ №${order.number} оплачен · ${formatKgs(payment.amountKgs)} · ${channel}`,
    body: [...orderBlock(order), abroad ? '🌍 Доставка: другая страна' : '📍 Доставка: Кыргызстан'],
    customer: { ...customer, phone: order.phone },
    orderId: order.id,
    adminOrigin,
  });
}

/** An online order whose payment link expired unpaid: the link is ready to send again. */
export function unpaidMessage(
  order: PaymentOrderForMessage,
  customer: CustomerText,
  adminOrigin: string,
): OutgoingMessage {
  return compose({
    subject: `Заказ №${order.number} не оплачен`,
    header: `⏰ Заказ №${order.number} не оплачен · ${formatKgs(order.totalKgs + order.adjustmentKgs)}`,
    body: ['Клиент выбрал онлайн-оплату, но не оплатил.', '', ...orderBlock(order)],
    customer: { ...customer, phone: order.phone },
    orderId: order.id,
    adminOrigin,
  });
}

const REVIEW_TEXT = {
  amount: (paid: string, expected: string) => `Пришло ${paid}, а заказ на ${expected}.`,
  double: () => 'Заказ уже был оплачен, это второй платёж. Лишнее можно вернуть в кабинете Finik.',
  cancelled: () => 'Заказ отменён, а оплата пришла. Верните деньги в кабинете Finik или восстановите заказ.',
  deleted: () => 'Заказ удалён, а оплата пришла.',
  account: () =>
    'Счёт получателя в уведомлении Finik не совпал с вашим, поэтому сайт не засчитал оплату сам. Проверьте её в кабинете Finik: если деньги пришли, отметьте заказ оплаченным.',
} as const;

/** A payment that needs the owner's eyes (docs/finik/SPEC.md §5.7). */
export function reviewMessage(
  input: {
    reason: keyof typeof REVIEW_TEXT;
    number: number | null;
    orderId: string | null;
    paidKgs: number | null;
    expectedKgs: number;
  },
  adminOrigin: string,
): OutgoingMessage {
  const paid = input.paidKgs === null ? 'неизвестная сумма' : formatKgs(input.paidKgs);
  const title = input.number ? `Проверьте оплату заказа №${input.number}` : 'Проверьте оплату';
  return compose({
    subject: title,
    header: `❗ ${title}`,
    body: [
      REVIEW_TEXT[input.reason](paid, formatKgs(input.expectedKgs)),
      ...(input.paidKgs === null ? [] : [`Сумма платежа: ${paid}`]),
    ],
    orderId: input.reason === 'deleted' ? null : input.orderId,
    adminOrigin,
  });
}

/**
 * The 1 сом check from «Настройки → Оплата» was paid: webhooks reach us. In mock mode it went through the local stand-in,
 * which proves nothing about Finik, and the message says so.
 */
export function checkPaidMessage(adminOrigin: string, mock = false): OutgoingMessage {
  return mock
    ? compose({
        subject: 'Проверка прошла в тестовом режиме',
        header: '✅ Проверка прошла в тестовом режиме',
        body: ['Платёж прошёл через заглушку на сервере. Настоящий Finik не проверялся.'],
        adminOrigin,
      })
    : compose({
        subject: 'Проверка Finik прошла',
        header: '✅ Проверка Finik прошла',
        body: ['Платёж 1 сом получен: онлайн-оплата работает.'],
        adminOrigin,
      });
}

/** Money paid into our Finik account for a payment the site does not know (for example after restoring a backup). */
export function unknownPaymentMessage(
  input: { amountKgs: number | null; description: string | null; operationId: string | null },
  adminOrigin: string,
): OutgoingMessage {
  return compose({
    subject: 'Оплата без заказа на сайте',
    header: '❗ Пришла оплата, которую сайт не нашёл',
    body: [
      ...(input.amountKgs === null ? [] : [`Сумма: ${formatKgs(input.amountKgs)}`]),
      ...(input.description ? [`Назначение: ${input.description}`] : []),
      ...(input.operationId ? [`Операция Finik: ${input.operationId}`] : []),
      'Проверьте её в кабинете Finik и отметьте заказ оплаченным вручную.',
    ],
    adminOrigin,
  });
}
