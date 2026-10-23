import { describe, expect, it } from 'vitest';
import { formatKgs } from './money';
import {
  buildOrderItemsText,
  buildOrderMessage,
  buildOrderQuestionMessage,
  buildPaidMessage,
  buildPaymentHelpMessage,
  buildQuizMessage,
  buildSchemeRequestMessage,
  buildWholesaleMessage,
  DEFAULT_WHATSAPP_TEMPLATES,
  paidTemplateFor,
  renderWhatsappTemplate,
  upgradeWhatsappTemplates,
  waLink,
} from './whatsapp';

describe('WhatsApp messages', () => {
  it('one-line order: no "Итого", × only above 1', () => {
    const text = buildOrderMessage({
      lines: [{ type: 'program', title: 'Акне и постакне', qty: 2, total: formatKgs(11800) }],
      total: formatKgs(11800),
      name: ' Айгерим ',
      phone: '+996 555 12 34 56',
      address: 'Бишкек, ул. Токтогула 1',
      comment: '',
    });
    expect(text).toBe(
      [
        'Здравствуйте! Хочу заказать:',
        '• Программа «Акне и постакне» × 2 — 11\u00a0800\u00a0сом',
        '',
        'Имя: Айгерим',
        'Телефон: +996 555 12 34 56',
        'Адрес: Бишкек, ул. Токтогула 1',
        '',
        'Пришлите, пожалуйста, реквизиты для оплаты.',
      ].join('\n'),
    );
  });

  it('cart order lists every line, the total and the сом sum', () => {
    const text = buildOrderMessage({
      lines: [
        { type: 'product', title: 'PDRN Perfect Ampoule', qty: 1, total: '45\u00a0$' },
        { type: 'product', title: 'Солнцезащитный флюид SPF 50+', qty: 2, total: '30\u00a0$' },
      ],
      total: '75\u00a0$',
      totalKgs: formatKgs(6500),
      name: 'Сабина',
      phone: '+7 701 334 12 08',
      address: 'Алматы',
      comment: 'Позвонить за час',
    });
    expect(text).toBe(
      [
        'Здравствуйте! Хочу заказать:',
        '• PDRN Perfect Ampoule — 45\u00a0$',
        '• Солнцезащитный флюид SPF 50+ × 2 — 30\u00a0$',
        'Итого: 75\u00a0$',
        '',
        'Имя: Сабина',
        'Телефон: +7 701 334 12 08',
        'Адрес: Алматы',
        'Комментарий: Позвонить за час',
        'Сумма в сомах: 6\u00a0500\u00a0сом',
        '',
        'Пришлите, пожалуйста, реквизиты для оплаты.',
      ].join('\n'),
    );
  });

  it('wholesale message with and without choices', () => {
    expect(buildWholesaleMessage({})).toBe(
      'Здравствуйте, Нурайым! Хочу получить оптовый прайс и консультацию.',
    );
    expect(buildWholesaleMessage({ buyer: 'salon', country: 'ru' })).toBe(
      'Здравствуйте, Нурайым! Хочу получить оптовый прайс и консультацию.\n\nПредставляю салон, доставка в Россию (Москва).',
    );
    expect(buildWholesaleMessage({ country: 'kz' })).toContain('\n\nДоставка в Казахстан.');
  });

  it('quiz message lists the four answers and the suggested programs', () => {
    const text = buildQuizMessage({ goal: 'acne', skin: 'combo', exp: 'some', age: '25' }, [
      { title: 'Акне и постакне', price: formatKgs(5900) },
      { title: 'Чёрные точки и поры', price: formatKgs(5400) },
    ]);
    expect(text).toBe(
      [
        'Здравствуйте, Нурайым! Прошла тест «Подобрать программу ухода за 1 минуту» на сайте.',
        '— Задача: Избавиться от высыпаний, чёрных точек и закрытых комедонов',
        '— Кожа через 2–3 часа после умывания: Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно',
        '— Активная косметика: Пробовала отдельные средства, но нет чёткой системы',
        '— Возраст: 25–35 лет',
        'Сайт предложил: «Акне и постакне», 5\u00a0900\u00a0сом; «Чёрные точки и поры», 5\u00a0400\u00a0сом. Помогите выбрать, пожалуйста.',
      ].join('\n'),
    );
  });

  it('scheme request names the program', () => {
    expect(buildSchemeRequestMessage('Пигментация')).toBe(
      'Здравствуйте, Нурайым! Пришлите, пожалуйста, схему ухода по программе «Пигментация».',
    );
  });

  it('builds wa.me links from any phone format', () => {
    expect(waLink('+996 706 304 803', 'Привет')).toBe(
      'https://wa.me/996706304803?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82',
    );
  });
});

describe('online payment texts', () => {
  const order = {
    lines: [{ type: 'program' as const, title: 'Акне и постакне', qty: 1, total: formatKgs(5900) }],
    total: formatKgs(5900),
    name: 'Айгерим',
    phone: '+996 555 12 34 56',
    address: 'Бишкек, ул. Токтогула 1',
  };

  it('records an online order with its own closing line', () => {
    const text = buildOrderMessage(order, { closing: 'online' });
    expect(text.endsWith('\n\nОплата онлайн через Finik.')).toBe(true);
    expect(text).not.toContain('реквизиты');
  });

  it('adds the site order number for the WhatsApp fallback', () => {
    const text = buildOrderMessage(order, { number: 1042 });
    expect(text).toContain('Адрес: Бишкек, ул. Токтогула 1\nНомер заказа на сайте: №1042\n\nПришлите');
  });

  it('lists what was ordered: quantity, price and the owner adjustment', () => {
    const lines = [
      { type: 'program' as const, title: 'Акне и постакне', qty: 1, totalKgs: 5900 },
      { type: 'product' as const, title: 'Cica-сыворотка', qty: 2, totalKgs: 3800 },
    ];
    expect(buildOrderItemsText({ lines })).toBe(
      `• Программа «Акне и постакне» × 1 · ${formatKgs(5900)}\n• Cica-сыворотка × 2 · ${formatKgs(3800)}`,
    );
    expect(buildOrderItemsText({ lines, adjustmentKgs: 300, adjustmentNote: ' Доставка ' })).toMatch(
      new RegExp(`\\n• Доставка: \\+${formatKgs(300)}$`),
    );
    expect(buildOrderItemsText({ lines, adjustmentKgs: -500, adjustmentNote: null })).toMatch(
      new RegExp(`\\n• Корректировка: −${formatKgs(500)}$`),
    );
  });

  it('fills every placeholder of the owner templates', () => {
    const values = {
      name: ' Бекзат ',
      number: 1043,
      items: `• Cica-сыворотка × 2 · ${formatKgs(3800)}\n• Доставка: +${formatKgs(300)}`,
      total: formatKgs(4100),
      address: 'Ош, ул. Ленина 10',
      link: 'https://bom-beauty.com/pay/k7Qm2x',
    };
    expect(renderWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATES.link, values)).toBe(
      `Здравствуйте, Бекзат! Ваш заказ №1043:\n${values.items}\n\nК оплате: ${formatKgs(4100)}\n` +
        'Оплатить можно по ссылке: https://bom-beauty.com/pay/k7Qm2x',
    );
    const paid = renderWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATES.paidLocal, values);
    expect(paid).toContain(`В заказе:\n${values.items}\nОплачено: ${formatKgs(4100)}`);
    expect(paid).toContain('Доставим по адресу: Ош, ул. Ленина 10.');
    expect(renderWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATES.paidAbroad, values)).toContain(values.items);
    expect(renderWhatsappTemplate('{имя}, {заказ}, {неизвестно}', values)).toBe('Бекзат, 1043, {неизвестно}');
  });

  it('moves saved first-version templates to the new defaults, and keeps edited ones', () => {
    const edited = 'Салам, {имя}! Заказ №{заказ}: {ссылка}';
    const first = {
      link: 'Здравствуйте, {имя}! Ваш заказ №{заказ} на {сумма}. Оплатить можно по ссылке: {ссылка}',
      paidLocal:
        'Здравствуйте, {имя}! Оплату за заказ №{заказ} получили, спасибо 🌸 Доставим по адресу: {адрес}. Когда вам удобно принять заказ?',
      paidAbroad: edited,
    };
    expect(upgradeWhatsappTemplates(first)).toEqual({
      link: DEFAULT_WHATSAPP_TEMPLATES.link,
      paidLocal: DEFAULT_WHATSAPP_TEMPLATES.paidLocal,
      paidAbroad: edited,
    });
    for (const text of Object.values(DEFAULT_WHATSAPP_TEMPLATES)) expect(text).toContain('{состав}');
  });

  it('picks the delivery template from the phone country', () => {
    expect(paidTemplateFor('+996555123456')).toBe('paidLocal');
    expect(paidTemplateFor('+77011234567')).toBe('paidAbroad');
    expect(paidTemplateFor('+998901234567')).toBe('paidAbroad');
  });

  it('prepares the customer messages of the payment page', () => {
    expect(buildPaidMessage({ number: 1042, total: formatKgs(5900) })).toBe(
      'Здравствуйте! Заказ №1042 на сайте оплачен: 5 900 сом.',
    );
    expect(buildPaymentHelpMessage({ number: 1042 })).toBe(
      'Здравствуйте! По заказу №1042 на сайте оплата не подтвердилась. Проверьте, пожалуйста.',
    );
    expect(buildOrderQuestionMessage({ number: 1042 })).toBe(
      'Здравствуйте! У меня вопрос по заказу №1042 на сайте.',
    );
  });

  it('never uses an em-dash in our own texts', () => {
    for (const text of Object.values(DEFAULT_WHATSAPP_TEMPLATES)) expect(text).not.toContain('—');
  });
});
