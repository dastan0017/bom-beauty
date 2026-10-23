import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoViolations } from './support/axe';
import { whenHydrated } from './support/hydration';

// Online payment against `pnpm dev` with FINIK_ENV=mock (docs/finik/SPEC.md §8): the fake Finik page sends a webhook
// signed like Finik's, so the order is paid through the real verification path. The dev seed switches online payment
// on with WhatsApp preselected, so the WhatsApp specs keep their default.

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/v1';

// The API takes 6 orders a minute per IP, and every online order is awaited: each order-placing test runs on one
// device only (phone or desktop), so a full `pnpm e2e` stays under the limit.
// These tests also cross to the API's fake Finik page and wait for its webhook: they get the slow-test budget.
const onlyOn = (project: 'phone' | 'desktop') => {
  test.skip(test.info().project.name !== project, `orders are placed on ${project} only`);
  test.slow();
};
const sheetOf = (page: Page) => page.getByRole('dialog', { name: 'Оформление заказа' });

async function payOnline(sheet: Locator, name: string): Promise<void> {
  await sheet.getByText('Онлайн', { exact: true }).click();
  await expect(sheet.getByText('Номер с WhatsApp: сюда напишем об оплате и доставке')).toBeVisible();
  await sheet.getByLabel('Имя').fill(name);
  await sheet.getByLabel('Телефон').fill('+996 555 12 34 56');
  await sheet.getByLabel('Адрес доставки').fill('Бишкек, ул. Тестовая 1');
  await sheet.getByRole('button', { name: /^Оплатить/ }).click();
}

/** On the mock Finik page: «Оплатить», then back on the site until the webhook has landed. */
async function payOnMockFinik(page: Page): Promise<void> {
  await page.waitForURL(/\/v1\/dev\/finik\/pay\//);
  await expect(page.getByText('Finik · тестовый режим')).toBeVisible();
  await page.getByRole('button', { name: 'Оплатить' }).click();
  await page.waitForURL(/\/pay\/[0-9a-f]{32}\?from=finik$/);
  await expect(page.getByRole('heading', { name: 'Оплата прошла' })).toBeVisible({ timeout: 20_000 });
}

test('a program ordered online is paid on Finik; the cart stays as it was', async ({ page }) => {
  onlyOn('phone');
  await page.goto('/catalog');
  await (await whenHydrated(page.getByRole('button', { name: 'В корзину' }).first())).click();
  const cart = await page.evaluate(() => localStorage.getItem('bb-cart'));
  expect(cart).not.toBeNull();

  await page.goto('/programs/acne');
  const order = page.getByRole('button', { name: 'Заказать программу' }).filter({ visible: true }).first();
  await (await whenHydrated(order)).click();
  await payOnline(sheetOf(page), `E2E online ${randomUUID().slice(0, 6)}`);
  await payOnMockFinik(page);
  await expect(page.getByText(/Заказ №\d+ оплачен: 5\s900\sсом/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bb-cart'))).toBe(cart);
});

test('a cart ordered online empties once it is paid', async ({ page }) => {
  onlyOn('desktop');
  await page.goto('/catalog');
  await (await whenHydrated(page.getByRole('button', { name: 'В корзину' }).first())).click();
  await page.getByRole('button', { name: /Оформить/ }).click();
  await payOnline(sheetOf(page), `E2E cart ${randomUUID().slice(0, 6)}`);
  await payOnMockFinik(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bb-cart'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('bb-pending-payment'))).toBeNull();
});

test('the payment page from a link: what is ordered, «Оплатить», then paid', async ({ page, request }) => {
  onlyOn('desktop');
  const created = await request.post(`${API}/orders`, {
    data: {
      clientRef: randomUUID(),
      items: [{ type: 'product', slug: 'dr-sgn-cica-serum', qty: 2 }],
      name: `E2E link ${randomUUID().slice(0, 6)}`,
      phone: '+996 555 12 34 56',
      address: 'Бишкек, ул. Тестовая 1',
      message: 'Здравствуйте! Хочу заказать',
      pageUrl: 'http://localhost:3100/catalog',
      paymentMethod: 'finik',
    },
  });
  expect(created.status()).toBe(201);
  const { payment } = (await created.json()) as { payment: { page: string } };

  await page.goto(payment.page);
  await expect(page.getByRole('heading', { name: 'Оплата заказа' })).toBeVisible();
  await expect(page.getByText('Успокаивающая cica-сыворотка')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Написать Нурайым' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\//,
  );
  await expectNoViolations(page);
  await (await whenHydrated(page.getByRole('button', { name: /^Оплатить 3\s800\sсом$/ }))).click();
  await payOnMockFinik(page);
  await expect(page.getByText('Оплачено')).toBeVisible();
  await expectNoViolations(page);
});

test('a11y: order sheet with the payment choice', async ({ page }) => {
  await page.goto('/programs/acne');
  const order = page.getByRole('button', { name: 'Заказать программу' }).filter({ visible: true }).first();
  await (await whenHydrated(order)).click();
  const sheet = sheetOf(page);
  await expect(sheet.getByRole('radiogroup', { name: 'Способ оплаты' })).toBeVisible();
  await sheet.getByText('Онлайн', { exact: true }).click();
  await expect(sheet.getByRole('radio', { name: 'Онлайн' })).toBeChecked();
  await sheet.getByRole('button', { name: /^Оплатить/ }).click();
  await expect(sheet.getByText('Как к вам обращаться?')).toBeVisible();
  await expectNoViolations(page, '[role=dialog]');
});

test('an unknown payment link is a 404', async ({ page }) => {
  const response = await page.goto('/pay/0123456789abcdef0123456789abcdef');
  expect(response?.status()).toBe(404);
});
