import { formatKgs } from '@bom/shared';
import { describe, expect, it } from 'vitest';
import {
  checkPaidMessage,
  paidMessage,
  reviewMessage,
  unknownPaymentMessage,
  unpaidMessage,
  whatsappOrderMessage,
  type PaymentOrderForMessage,
} from './messages';

const order: PaymentOrderForMessage = {
  id: 'order-1',
  number: 1042,
  lines: [
    { type: 'product', title: 'Cica-сыворотка', qty: 2, totalKgs: 3800 },
    { type: 'product', title: 'Флюид SPF 50+', qty: 1, totalKgs: 1300 },
  ],
  totalKgs: 5100,
  adjustmentKgs: 0,
  adjustmentNote: null,
  name: 'Айгерим <b>',
  phone: '+996555123456',
  address: 'Бишкек, ул. Токтогула 1',
  comment: null,
  fromQuiz: false,
};
const customer = {
  whatsappText: 'Здравствуйте, Айгерим! Ссылка: https://bom-beauty.com/pay/t <ok>',
  button: '💬 Отправить',
};
const HTTPS_ADMIN = 'https://admin.bom-beauty.com';

describe('payment messages', () => {
  it('previews the WhatsApp text and sends it with one button', () => {
    const message = whatsappOrderMessage(order, customer, HTTPS_ADMIN);
    expect(message.subject).toBe('Новый заказ №1042');
    expect(message.html.split('\n')[0]).toBe('<b>🛍 Заказ №1042 · через WhatsApp · не оплачен</b>');
    expect(message.html).toContain(
      `• Cica-сыворотка × 2 · ${formatKgs(3800)}\n• Флюид SPF 50+ × 1 · ${formatKgs(1300)}\nИтого: ${formatKgs(5100)}`,
    );
    expect(message.html).toContain('Айгерим &lt;b&gt; · +996 555 12 34 56');
    expect(message.html).toContain(
      '<blockquote><b>Клиент получит в WhatsApp:</b>\nЗдравствуйте, Айгерим! Ссылка: https://bom-beauty.com/pay/t &lt;ok&gt;</blockquote>',
    );
    expect(message.buttons).toEqual([
      {
        text: '💬 Отправить',
        url: `https://wa.me/996555123456?text=${encodeURIComponent(customer.whatsappText)}`,
      },
      { text: 'Открыть в админке', url: `${HTTPS_ADMIN}/orders/order-1` },
    ]);
    expect(message.text).toContain(`Отправить: https://wa.me/996555123456?text=`);
    expect(`${message.html}${message.text}`).not.toContain('—');
  });

  it('keeps the admin link as text when the admin is not on https (Telegram refuses such buttons)', () => {
    const message = whatsappOrderMessage(order, customer, 'http://localhost:5173');
    expect(message.buttons.map((button) => button.text)).toEqual(['💬 Отправить']);
    expect(message.html).toContain('<a href="http://localhost:5173/orders/order-1">Открыть в админке</a>');
  });

  it('shows an adjustment and the amount due', () => {
    const adjusted = { ...order, adjustmentKgs: 300, adjustmentNote: 'Доставка' };
    expect(unpaidMessage(adjusted, customer, HTTPS_ADMIN).html).toContain(
      `Итого: ${formatKgs(5100)}\nДоставка: +${formatKgs(300)}\nК оплате: ${formatKgs(5400)}`,
    );
    const discount = { ...order, adjustmentKgs: -100, adjustmentNote: null };
    expect(unpaidMessage(discount, customer, HTTPS_ADMIN).text).toContain(
      `Корректировка: −${formatKgs(100)}\nК оплате: ${formatKgs(5000)}`,
    );
    expect(unpaidMessage(adjusted, customer, HTTPS_ADMIN).html.split('\n')[0]).toBe(
      `<b>⏰ Заказ №1042 не оплачен · ${formatKgs(5400)}</b>`,
    );
  });

  it('names the channel and where the order goes once paid', () => {
    const local = paidMessage(order, { amountKgs: 5100, channel: 'qr' }, customer, HTTPS_ADMIN);
    expect(local.html.split('\n')[0]).toBe(`<b>✅ Заказ №1042 оплачен · ${formatKgs(5100)} · QR-код</b>`);
    expect(local.text).toContain('📍 Доставка: Кыргызстан');
    const abroad = paidMessage(
      { ...order, phone: '+77011234567' },
      { amountKgs: 5100, channel: 'visa' },
      customer,
      HTTPS_ADMIN,
    );
    expect(abroad.subject).toBe('Заказ №1042 оплачен');
    expect(abroad.html.split('\n')[0]).toContain('· Visa');
    expect(abroad.text).toContain('🌍 Доставка: другая страна');
    expect(abroad.buttons[0]?.url.startsWith('https://wa.me/77011234567?text=')).toBe(true);
  });

  it('explains each review reason, without an admin link for a deleted order', () => {
    const amount = reviewMessage(
      { reason: 'amount', number: 1042, orderId: 'order-1', paidKgs: 100, expectedKgs: 5100 },
      HTTPS_ADMIN,
    );
    expect(amount.subject).toBe('Проверьте оплату заказа №1042');
    expect(amount.text).toContain(`Пришло ${formatKgs(100)}, а заказ на ${formatKgs(5100)}.`);
    expect(amount.buttons).toEqual([{ text: 'Открыть в админке', url: `${HTTPS_ADMIN}/orders/order-1` }]);
    const deleted = reviewMessage(
      { reason: 'deleted', number: null, orderId: null, paidKgs: 5100, expectedKgs: 5100 },
      HTTPS_ADMIN,
    );
    expect(deleted.subject).toBe('Проверьте оплату');
    expect(deleted.text).toContain('Заказ удалён, а оплата пришла.');
    expect(deleted.buttons).toEqual([]);
    for (const reason of ['double', 'cancelled', 'account'] as const) {
      const message = reviewMessage(
        { reason, number: 1042, orderId: 'order-1', paidKgs: null, expectedKgs: 1 },
        HTTPS_ADMIN,
      );
      // Without a known amount the line is left out rather than guessed.
      expect(message.text).not.toContain('Сумма платежа');
      expect(message.text).toContain('Finik');
    }
  });

  it('confirms the connection check, and never claims Finik was checked in mock mode', () => {
    const message = checkPaidMessage(HTTPS_ADMIN);
    expect(message.html).toBe(
      '<b>✅ Проверка Finik прошла</b>\nПлатёж 1 сом получен: онлайн-оплата работает.',
    );
    expect(message.buttons).toEqual([]);
    const mock = checkPaidMessage(HTTPS_ADMIN, true);
    expect(mock.text).toContain('тестовом режиме');
    expect(mock.text).toContain('Настоящий Finik не проверялся');
  });

  it('describes money that matches no payment', () => {
    const message = unknownPaymentMessage(
      { amountKgs: 5900, description: 'Заказ №1093', operationId: 'op-1_DEBIT' },
      HTTPS_ADMIN,
    );
    expect(message.text).toContain(
      `Сумма: ${formatKgs(5900)}\nНазначение: Заказ №1093\nОперация Finik: op-1_DEBIT`,
    );
    expect(message.buttons).toEqual([]);
  });
});
