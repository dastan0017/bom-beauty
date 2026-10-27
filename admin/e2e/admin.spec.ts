import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// One login per run: the API allows 5 login attempts per minute per IP (docs/API.md §3).
test.describe.configure({ mode: 'serial' });
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});
test.afterAll(async () => {
  await page.close();
});

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/v1';
const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? 'owner@bom-beauty.com',
  password: process.env.SEED_OWNER_PASSWORD ?? 'change-me-please',
};

async function login(): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Почта').fill(OWNER.email);
  await page.getByLabel('Пароль').fill(OWNER.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Доброе|Добрый|Доброй/);
}

test('wrong password shows a generic error', async () => {
  await page.goto('/');
  await page.getByLabel('Почта').fill(OWNER.email);
  await page.getByLabel('Пароль').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('alert')).toHaveText('Неверная почта или пароль');
});

test('orders: status change, note, history; leads and customers render', async ({ request }) => {
  const name = `E2E ${randomUUID().slice(0, 6)}`;
  const created = await request.post(`${API}/orders`, {
    data: {
      clientRef: randomUUID(),
      items: [
        { type: 'product', slug: 'dr-sgn-cica-serum', qty: 1 },
        { type: 'product', slug: 'dr-sgn-centella-cleansing-foam', qty: 2 },
      ],
      name,
      phone: '+996 555 00 11 22',
      address: 'Бишкек, ул. Тестовая, 5',
      message: 'Здравствуйте! Хочу заказать',
      pageUrl: 'http://localhost:3100/catalog',
    },
  });
  expect(created.status()).toBe(201);

  await login();
  await page
    .getByRole('link', { name: /Заказы/ })
    .first()
    .click();
  await page.getByRole('searchbox', { name: 'Поиск по имени, телефону или заказу' }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toHaveCount(1);

  await row.getByRole('combobox').selectOption('sent');
  await expect(page.getByText('Статус изменён').first()).toBeVisible();

  await row.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Отправлен → ', { exact: false })).toHaveCount(0);
  await expect(drawer.getByText('Новый → Отправлен')).toBeVisible();
  await expect(drawer.getByText('Пенка для умывания с центеллой', { exact: true })).toBeVisible();
  await drawer.getByLabel('Заметка').fill('Оплата получена (e2e)');
  await drawer.getByRole('button', { name: 'Сохранить заметку' }).click();
  await expect(drawer.getByText('Изменена заметка')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/orders(\?|$)/);

  await page.getByRole('link', { name: 'Заявки' }).first().click();
  await expect(page.getByRole('heading', { name: 'Заявки' })).toBeVisible();
  await page.getByRole('link', { name: 'Клиенты' }).first().click();
  await expect(page.getByRole('row').filter({ hasText: '+996 555 00 11 22' }).first()).toBeVisible();
});

test('catalog: create a product, see it on the site, find it in the list, delete it there', async ({
  request,
}) => {
  const name = `E2E товар ${Date.now().toString().slice(-6)}`;
  await page.getByRole('link', { name: 'Товары' }).first().click();
  await page.getByRole('button', { name: 'Добавить товар' }).click();
  await page.getByLabel('Название', { exact: true }).fill(name);
  await page.getByLabel('Бренд', { exact: true }).fill('Dr. SGN');
  await page.getByLabel('Цена, сом').fill('2500');
  await page.getByLabel('Коротко, для карточки').fill('Проверка e2e');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);

  const slug = await page.getByLabel('Адрес страницы').inputValue();
  const site = await request.get(`${process.env.E2E_SITE_URL ?? 'http://localhost:3100'}/catalog/${slug}`);
  expect(site.status()).toBe(200);
  expect(await site.text()).toContain(name);

  // The editor ends with the delete button.
  await expect(page.getByRole('button', { name: 'Удалить товар' })).toBeVisible();

  // The list: the brand chip and the search find it; the row's delete asks first.
  await page.getByRole('link', { name: 'Товары' }).first().click();
  await page.getByRole('button', { name: /^Dr\. SGN \d+$/ }).click();
  await expect(page).toHaveURL(/brand=Dr\.\+SGN/);
  await page.getByRole('searchbox', { name: 'Поиск по названию или бренду' }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: `Удалить товар: ${name}` }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText(`Удалить «${name}»?`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByText('Товар удалён')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);
});

test('catalog: tick products in the list, hide them and delete them in one go', async () => {
  const tag = `E2E пакет ${Date.now().toString().slice(-6)}`;
  for (const n of [1, 2]) {
    await page.getByRole('link', { name: 'Товары' }).first().click();
    await page.getByRole('button', { name: 'Добавить товар' }).click();
    await page.getByLabel('Название', { exact: true }).fill(`${tag} ${n}`);
    await page.getByLabel('Бренд', { exact: true }).fill('Dr. SGN');
    await page.getByLabel('Цена, сом').fill('1000');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Изменения сохранены')).toBeVisible();
  }

  await page.getByRole('link', { name: 'Товары' }).first().click();
  await page.getByRole('searchbox', { name: 'Поиск по названию или бренду' }).fill(tag);
  await expect(page.getByRole('row').filter({ hasText: tag })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все' }).first().check();
  const bar = page.getByRole('region', { name: 'Действия с выбранными товарами' });
  await expect(bar.getByText('Выбрано 2')).toBeVisible();

  await bar.getByRole('button', { name: 'Скрыть с сайта' }).click();
  await expect(page.getByText('Готово: 2 товара')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: tag }).getByText('скрыт')).toHaveCount(2);

  await bar.getByRole('button', { name: 'Удалить' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Удалить 2 товара?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByRole('row').filter({ hasText: tag })).toHaveCount(0);
  await expect(bar).toHaveCount(0);
});

test('catalog: a category is renamed and deleted from its «⋯» settings; duplicate names are refused', async () => {
  const name = `E2E категория ${Date.now().toString().slice(-6)}`;
  const renamed = `${name} новая`;
  await page.getByRole('link', { name: 'Товары' }).first().click();
  await page.getByRole('button', { name: 'Категория', exact: true }).click();
  await page.getByRole('textbox', { name: 'Например: Маски' }).fill(name);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByText('Категория добавлена')).toBeVisible();

  // The same name with other case and punctuation is the same category.
  await page.getByRole('button', { name: 'Категория', exact: true }).click();
  await page.getByRole('textbox', { name: 'Например: Маски' }).fill(` ${name.toUpperCase()}. `);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByText('Такая категория уже есть')).toBeVisible();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();

  await page.getByRole('button', { name: `Настроить «${name}»` }).click();
  const dialog = page.getByRole('dialog', { name: `Категория «${name}»` });
  await dialog.getByLabel('Название').fill(renamed);
  await dialog.getByRole('button', { name: 'Сохранить название' }).click();
  await expect(page.getByText('Название сохранено')).toBeVisible();

  await page.getByRole('button', { name: `Настроить «${renamed}»` }).click();
  await page
    .getByRole('dialog', { name: `Категория «${renamed}»` })
    .getByRole('button', { name: 'Удалить' })
    .click();
  await expect(page.getByText('Категория удалена')).toBeVisible();
  await expect(page.getByRole('button', { name: `Настроить «${renamed}»` })).toHaveCount(0);
});

test('payments: the link to send, a WhatsApp order marked paid, the «Оплата» settings', async ({
  request,
}) => {
  const name = `E2E pay ${randomUUID().slice(0, 6)}`;
  const created = await request.post(`${API}/orders`, {
    data: {
      clientRef: randomUUID(),
      items: [{ type: 'product', slug: 'dr-sgn-cica-serum', qty: 1 }],
      name,
      phone: '+996 555 00 11 22',
      address: 'Бишкек, ул. Тестовая, 5',
      message: 'Здравствуйте! Хочу заказать',
      pageUrl: 'http://localhost:3100/catalog',
      paymentMethod: 'whatsapp',
    },
  });
  expect(created.status()).toBe(201);

  await page
    .getByRole('link', { name: /Заказы/ })
    .first()
    .click();
  await page.getByRole('searchbox', { name: 'Поиск по имени, телефону или заказу' }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.click();
  const drawer = page.getByRole('dialog');
  // With online payment on (the dev seed), the drawer offers the order's payment link for WhatsApp.
  await expect(drawer.getByRole('link', { name: 'Отправить ссылку' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/996555001122\?text=.*%2Fpay%2F[0-9a-f]{32}/,
  );
  await drawer.getByLabel('Статус оплаты').selectOption('paid');
  await expect(page.getByText('Статус оплаты изменён').first()).toBeVisible();
  await expect(drawer.getByText('Оплата: Не оплачен → Оплачен')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row.getByText('Оплачен')).toBeVisible();

  await page.getByRole('link', { name: 'Настройки' }).first().click();
  await page.getByRole('link', { name: 'Оплата', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Подключение Finik' })).toBeVisible();
  await expect(page.getByText('Тестовый режим, без Finik')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Принимать онлайн-оплату на сайте' })).toBeChecked();
});

test('logout returns to the login screen', async () => {
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('heading', { name: 'Вход в админ-панель' })).toBeVisible();
});
