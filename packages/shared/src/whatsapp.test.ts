import { describe, expect, it } from 'vitest';
import { formatKgs } from './money';
import { buildOrderMessage, buildQuizMessage, buildWholesaleMessage, waLink } from './whatsapp';

describe('WhatsApp messages', () => {
  it('order message matches the design format', () => {
    const text = buildOrderMessage({
      item: { type: 'program', title: 'Акне и проблемная кожа' },
      qty: 2,
      total: formatKgs(11800),
      name: ' Айгерим ',
      phone: '+996 555 12 34 56',
      address: 'Бишкек, ул. Токтогула 1',
      comment: '',
    });
    expect(text).toBe(
      [
        'Здравствуйте! Хочу заказать:',
        '• Программа «Акне и проблемная кожа» × 2 — 11\u00a0800\u00a0сом',
        '',
        'Имя: Айгерим',
        'Телефон: +996 555 12 34 56',
        'Адрес: Бишкек, ул. Токтогула 1',
        '',
        'Пришлите, пожалуйста, реквизиты для оплаты.',
      ].join('\n'),
    );
  });

  it('adds the сом total and comment when present', () => {
    const text = buildOrderMessage({
      item: { type: 'product', title: 'PDRN Perfect Ampoule' },
      qty: 1,
      total: '45\u00a0$',
      totalKgs: formatKgs(3900),
      name: 'Сабина',
      phone: '+7 701 334 12 08',
      address: 'Алматы',
      comment: 'Позвонить за час',
    });
    expect(text).toContain('• PDRN Perfect Ampoule — 45\u00a0$');
    expect(text).toContain('Комментарий: Позвонить за час\nСумма в сомах: 3\u00a0900\u00a0сом');
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

  it('quiz message lists answers and programs', () => {
    const text = buildQuizMessage(
      { skin: 'oily', goal: 'acne', exp: 'new' },
      ['Акне и проблемная кожа', 'Пигментация'],
      true,
    );
    expect(text).toContain('— Тип кожи: Комбинированная / жирная');
    expect(text).toContain(
      'Сайт предложил программы: «Акне и проблемная кожа», «Пигментация». Помогите выбрать, пожалуйста.',
    );
  });

  it('builds wa.me links from any phone format', () => {
    expect(waLink('+996 706 304 803', 'Привет')).toBe(
      'https://wa.me/996706304803?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82',
    );
  });
});
