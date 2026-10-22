import { describe, expect, it } from 'vitest';
import { formatKgs } from './money';
import {
  buildOrderMessage,
  buildQuizMessage,
  buildSchemeRequestMessage,
  buildWholesaleMessage,
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
