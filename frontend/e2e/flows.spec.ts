import { expect, test, type Page } from '@playwright/test';
import { whenHydrated } from './support/hydration';

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

test('home: hero, programs and the way to WhatsApp', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Подобрать программу ухода за 1 минуту' })).toBeVisible();
  // Blocks of the October 2026 home: programs grid, catalog card, rails.
  await expect(page.getByRole('heading', { name: 'Готовые программы ухода' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Бестселлеры BOM BEAUTY' })).toBeAttached();
  await expect(page.getByRole('link', { name: /Открыть каталог/ })).toBeAttached();
  await expect(page.locator('a[href="/programs"]').first()).toBeVisible();
  await expect(page.locator('a[href="/catalog"]').first()).toBeVisible();
  await expect(page.locator('a[href^="https://wa.me/996"]').first()).toBeAttached();
});

test('first load leaves the order form code (zod, phone parsing) for later', async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scripts.push(response.text().catch(() => ''));
  });
  await page.goto('/', { waitUntil: 'load' });
  const initial = await Promise.all([...scripts]);
  expect(initial.length).toBeGreaterThan(0);
  expect(initial.some((body) => body.includes('country_calling_codes'))).toBe(false);
  // It still arrives before anyone needs it.
  await expect
    .poll(async () => (await Promise.all(scripts)).some((body) => body.includes('country_calling_codes')), {
      timeout: 15_000,
    })
    .toBe(true);
});

test.describe('catalog filter', () => {
  for (const javaScriptEnabled of [true, false]) {
    test.describe(javaScriptEnabled ? 'with JavaScript' : 'without JavaScript', () => {
      test.use({ javaScriptEnabled });

      test('category chips narrow the list', async ({ page }) => {
        await page.goto('/catalog');
        await expect(page.getByText('Пенка для умывания с центеллой')).toBeVisible();
        await page
          .getByRole('navigation', { name: 'По типу средства' })
          .getByRole('link', { name: 'Сыворотки' })
          .click();
        await expect(page).toHaveURL(/\/catalog\?category=serums$/);
        await expect(page.getByRole('link', { name: 'Сыворотки', exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        await expect(page.getByText('Успокаивающая cica-сыворотка')).toBeVisible();
        await expect(page.getByText('Пенка для умывания с центеллой')).toHaveCount(0);
      });

      test('problem chips show the program products and its banner', async ({ page }) => {
        await page.goto('/catalog');
        await expect(page.getByText('Гидрофильное масло')).toBeVisible();
        await page
          .getByRole('navigation', { name: 'По проблеме' })
          .getByRole('link', { name: 'Акне и постакне' })
          .click();
        await expect(page).toHaveURL(/\/catalog\?problem=acne$/);
        await expect(page.getByRole('link', { name: /Весь уход — в одной программе/ })).toHaveAttribute(
          'href',
          '/programs/acne',
        );
        await expect(page.getByText('Успокаивающая cica-сыворотка')).toBeVisible();
        await expect(page.getByText('Гидрофильное масло')).toHaveCount(0);
        // Both filters combine; the type chips keep the problem.
        await page
          .getByRole('navigation', { name: 'По типу средства' })
          .getByRole('link', { name: 'Сыворотки' })
          .click();
        await expect(page).toHaveURL(/\/catalog\?problem=acne&category=serums$/);
      });
    });
  }
});

test('cart order: add from the catalog, validation, WhatsApp hand-off, cart emptied', async ({ page }) => {
  await page.goto('/catalog');
  const foam = page.getByRole('article').filter({ hasText: 'Пенка для умывания с центеллой' });
  await (await whenHydrated(foam.getByRole('button', { name: 'В корзину' }))).click();
  await foam.getByRole('button', { name: 'Больше' }).click();
  await expect(foam.getByText('2 шт.')).toBeVisible();
  await page
    .getByRole('article')
    .filter({ hasText: 'Тонер с BHA-кислотой' })
    .getByRole('button', { name: 'В корзину' })
    .click();

  // The catalog bar replaces the quiz bar while the cart has items.
  await page.getByRole('button', { name: /Корзина · 3 товара/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
  await expect(sheet.getByRole('list', { name: 'Состав заказа' }).getByRole('listitem')).toHaveCount(2);

  await sheet.getByRole('button', { name: 'Отправить заказ в WhatsApp' }).click();
  await expect(sheet.getByText('Как к вам обращаться?')).toBeVisible();
  await expect(sheet.getByText('Нужен номер, чтобы Нурайым могла связаться')).toBeVisible();

  await sheet.getByLabel('Имя').fill('Тест');
  await sheet.getByLabel('Телефон').fill('+996 555 12 34 56');
  await sheet.getByLabel('Адрес доставки').fill('Бишкек, ул. Тестовая, 1');

  const recorded = page.waitForResponse(
    (r) => r.url().endsWith('/v1/orders') && r.request().method() === 'POST',
  );
  await expectWhatsApp(
    page,
    () => sheet.getByRole('button', { name: 'Отправить заказ в WhatsApp' }).click(),
    'Пенка для умывания с центеллой × 2',
  );
  const response = await recorded;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toMatchObject({
    items: [
      { type: 'product', qty: 2 },
      { type: 'product', qty: 1 },
    ],
  });
  await expect(sheet.getByRole('heading', { name: 'Заказ отправлен' })).toBeVisible();
  await expect(sheet.getByText('Итого:', { exact: false })).toBeVisible();

  await sheet.getByRole('button', { name: 'Продолжить покупки' }).click();
  await expect(page.getByRole('button', { name: /Корзина ·/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Подобрать уход за 1 минуту' })).toBeVisible();
});

test('product page: extras join the order', async ({ page }) => {
  await page.goto('/catalog/dr-sgn-cica-serum');
  await (await whenHydrated(page.getByRole('button', { name: 'Добавить' }).first())).click();
  // The order bar renders once for phones and once for the desktop column; one of them is visible.
  await expect(page.getByText('Добавлено к заказу').filter({ visible: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Заказать вместе/ })
    .filter({ visible: true })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
  const lines = sheet.getByRole('list', { name: 'Состав заказа' }).getByRole('listitem');
  await expect(lines).toHaveCount(2);
  await expect(lines.filter({ hasText: 'Успокаивающая cica-сыворотка' })).toHaveCount(1);
});

test('program order from the program page skips the cart', async ({ page }) => {
  await page.goto('/programs/acne');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Уход при');
  await page.getByRole('button', { name: 'Заказать программу' }).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
  await expect(sheet.getByText('Программа «Акне и постакне»')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Очистить' })).toHaveCount(0);
  await expect(sheet.getByText('Добавить ещё средства')).toHaveCount(0);
});

test('care scheme: the generated PDF downloads', async ({ request }) => {
  const response = await request.get('/programs/pores/scheme');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect(response.headers()['content-disposition']).toContain("filename*=UTF-8''");
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('quiz: four answers, results, WhatsApp review lead', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Подобрать программу ухода за 1 минуту' }).click();
  const quiz = page.getByRole('dialog', { name: 'Подобрать программу ухода за 1 минуту' });
  await expect(quiz).toBeVisible();
  for (const answer of [
    'Избавиться от высыпаний, чёрных точек и закрытых комедонов',
    'Блестит только Т-зона (лоб, нос, подбородок), а на щеках комфортно',
    'Пробовала отдельные средства, но нет чёткой системы',
    '25–35 лет',
  ]) {
    await quiz.getByRole('button', { name: answer }).click();
  }
  await expect(quiz.getByRole('heading', { name: 'Отлично!' })).toBeVisible();
  await expect(quiz.getByText('Также могут подойти')).toBeVisible();

  const recorded = page.waitForResponse((r) => r.url().endsWith('/v1/leads/quiz'));
  await expectWhatsApp(
    page,
    () => quiz.getByRole('button', { name: 'Спросить Нурайым в WhatsApp' }).click(),
    'Сайт предложил: «Акне и постакне»',
  );
  expect((await recorded).status()).toBe(201);

  await quiz.getByRole('button', { name: /Рекомендуем для вас/ }).click();
  await expect(page).toHaveURL(/\/programs\/acne$/);
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
