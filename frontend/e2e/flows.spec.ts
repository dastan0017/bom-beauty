import { expect, test, type Page } from '@playwright/test';

// The three hand-offs to WhatsApp: each must open wa.me with the prefilled text and record the submission.

// window.open is stubbed, so tests record the wa.me URL instead of loading WhatsApp.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const opened: string[] = [];
    Object.assign(window, { __opened: opened });
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return { opener: null } as Window;
    };
  });
});

async function expectWhatsApp(page: Page, action: () => Promise<void>, text: string): Promise<void> {
  await action();
  const url = await page.waitForFunction(() => (window as unknown as { __opened: string[] }).__opened.at(-1));
  const opened = decodeURIComponent(String(await url.jsonValue()));
  expect(opened).toMatch(/^https:\/\/wa\.me\/996\d{9}\?text=/);
  expect(opened).toContain(text);
}

test('product order: validation, WhatsApp hand-off, order recorded', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Заказать' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
  await expect(sheet).toBeVisible();

  await sheet.getByRole('button', { name: 'Отправить заказ в WhatsApp' }).click();
  await expect(sheet.getByText('Как к вам обращаться?')).toBeVisible();
  await expect(sheet.getByText('Нужен номер, чтобы Нурайым могла связаться')).toBeVisible();

  await sheet.getByLabel('Имя').fill('Тест');
  await sheet.getByLabel('Телефон').fill('+996 555 12 34 56');
  await sheet.getByLabel('Адрес доставки').fill('Бишкек, ул. Тестовая, 1');
  await sheet.getByRole('button', { name: 'Больше' }).click();

  const recorded = page.waitForResponse(
    (r) => r.url().endsWith('/v1/orders') && r.request().method() === 'POST',
  );
  await expectWhatsApp(
    page,
    () => sheet.getByRole('button', { name: 'Отправить заказ в WhatsApp' }).click(),
    '× 2',
  );
  expect((await recorded).status()).toBe(201);
  await expect(sheet.getByRole('heading', { name: 'Заказ отправлен' })).toBeVisible();
  await expect(sheet.getByText('Имя: Тест')).toBeVisible();
});

test('program order from the program page', async ({ page }) => {
  await page.goto('/programs/acne');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Уход при');
  await page.getByRole('button', { name: 'Заказать программу' }).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
  await expect(sheet.getByText('Программа «', { exact: false }).first()).toBeVisible();
});

test('quiz: four answers, results, WhatsApp review lead', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Подобрать уход за 1 минуту' }).first().click();
  const quiz = page.getByRole('dialog', { name: 'Выбрать программу за 1 минуту' });
  await expect(quiz).toBeVisible();
  for (const answer of [
    'Комбинированная / жирная',
    'Высыпания / акне',
    'Да, постоянно',
    'Готовый набор средств',
  ]) {
    await quiz.getByRole('button', { name: answer }).click();
  }
  await expect(quiz.getByRole('heading', { name: 'Подобрали для вас' })).toBeVisible();
  await expect(quiz.getByText('Рекомендуем')).toBeVisible();

  const recorded = page.waitForResponse((r) => r.url().endsWith('/v1/leads/quiz'));
  await expectWhatsApp(
    page,
    () => quiz.getByRole('button', { name: 'Спросить Нурайым в WhatsApp' }).click(),
    'Помогите выбрать',
  );
  expect((await recorded).status()).toBe(201);

  await quiz.getByRole('button', { name: /Рекомендуем/ }).click();
  await expect(page).toHaveURL(/\/programs\//);
  await expect(page.getByRole('button', { name: 'К результатам теста' }).first()).toBeVisible();
});

test('wholesale price request', async ({ page }) => {
  await page.goto('/wholesale');
  await page.getByRole('button', { name: 'Получить прайс и консультацию' }).click();
  const sheet = page.getByRole('dialog', { name: 'Прайс и консультация' });
  await sheet.getByRole('button', { name: 'Салон' }).click();
  await sheet.getByRole('button', { name: 'Казахстан' }).click();
  await expect(sheet.getByText('Под заказ: авиа')).toBeVisible();
  const recorded = page.waitForResponse((r) => r.url().endsWith('/v1/leads/wholesale'));
  await expectWhatsApp(
    page,
    () => sheet.getByRole('button', { name: 'Получить прайс в WhatsApp' }).click(),
    'Представляю салон, доставка в Казахстан',
  );
  expect((await recorded).status()).toBe(201);
  await expect(sheet.getByRole('heading', { name: 'Запрос отправлен' })).toBeVisible();
});

test('currency switch converts prices', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Валюта' }).click();
  await page.getByRole('option', { name: /USD/ }).click();
  await expect(page.getByText(/\d\s\$/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Валюта' })).toContainText('USD');
});

test('unknown pages return 404 with a way out', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
});
