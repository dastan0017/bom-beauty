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

test('orders: tick several orders, give them one status and delete them (D51)', async ({ request }) => {
  const tag = `E2E пакет ${randomUUID().slice(0, 6)}`;
  for (const n of [1, 2]) {
    const created = await request.post(`${API}/orders`, {
      data: {
        clientRef: randomUUID(),
        items: [{ type: 'product', slug: 'dr-sgn-cica-serum', qty: 1 }],
        name: `${tag} ${n}`,
        phone: '+996 555 00 11 22',
        address: 'Бишкек, ул. Тестовая, 5',
        message: 'Здравствуйте! Хочу заказать',
        pageUrl: 'http://localhost:3100/catalog',
      },
    });
    expect(created.status()).toBe(201);
  }

  await page
    .getByRole('link', { name: /Заказы/ })
    .first()
    .click();
  await page.getByRole('searchbox', { name: 'Поиск по имени, телефону или заказу' }).fill(tag);
  const rows = page.getByRole('row').filter({ hasText: tag });
  await expect(rows).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все' }).check();
  const bar = page.getByRole('region', { name: 'Действия с выбранными заказами' });
  await expect(bar.getByText('Выбрано 2')).toBeVisible();
  // A tick never opens the order.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await bar.getByRole('button', { name: 'Статус «Отправлен»' }).click();
  await expect(page.getByText('Готово: 2 заказа')).toBeVisible();
  await expect(bar).toHaveCount(0);
  for (const select of await rows.getByRole('combobox').all()) await expect(select).toHaveValue('sent');

  await page.getByRole('checkbox', { name: 'Выбрать все' }).check();
  await bar.getByRole('button', { name: 'Удалить' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Удалить 2 заказа?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Удалить' }).click();
  await expect(rows).toHaveCount(0);
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

test('catalog: «С этим средством ещё берут» picked in the editor shows on the product page (D49)', async ({
  request,
}) => {
  const relatedOnSite = async () => {
    const response = await request.get(`${API}/catalog/products/merikit-cleansing-oil`);
    const body = (await response.json()) as { related: { name: string }[] };
    return body.related.map((product) => product.name);
  };
  const auto = await relatedOnSite();
  await page.getByRole('link', { name: 'Товары' }).first().click();
  await page.getByRole('searchbox', { name: 'Поиск по названию или бренду' }).fill('Гидрофильное масло');
  await page.getByRole('link', { name: 'Гидрофильное масло', exact: true }).first().click();
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'С этим средством ещё берут' }) })
    .last();
  // Empty: the site's own pick is listed and taken over in one click.
  await expect(panel.getByText('Пока список пуст, сайт подбирает сам', { exact: false })).toBeVisible();
  await panel.getByRole('button', { name: 'Взять этот список и изменить' }).click();
  await expect(panel.getByRole('button', { name: 'Убрать из списка' })).toHaveCount(auto.length);
  await panel.getByRole('button', { name: 'Убрать из списка' }).first().click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  await expect.poll(relatedOnSite).toEqual(auto.slice(1));

  // Cleared again, the site picks by itself.
  const remove = panel.getByRole('button', { name: 'Убрать из списка' });
  while ((await remove.count()) > 0) await remove.first().click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect.poll(relatedOnSite).toEqual(auto);
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

test('programs: the picker finds a product by name; «Базовый уход» is saved for the site and removed', async ({
  request,
}) => {
  await page.getByRole('link', { name: 'Программы' }).first().click();
  await page.getByRole('link', { name: 'Пигментация', exact: true }).click();
  await expect(page).toHaveURL(/\/programs\/[0-9a-f-]{36}$/);

  // «Базовый уход» starts from «Оптимальный уход»'s products, drops two and gets the oil through the search.
  await page.getByRole('switch', { name: 'Добавить «Базовый уход»' }).click();
  const mini = page.locator('[data-variant="mini"]');
  await mini.getByRole('button', { name: 'Взять средства «Оптимальный уход»' }).click();
  await expect(mini.getByText('Средства «Базовый уход» · 5')).toBeVisible();
  await mini.getByRole('button', { name: 'Убрать из варианта «Базовый уход»' }).first().click();
  await mini.getByRole('button', { name: 'Убрать из варианта «Базовый уход»' }).first().click();
  await mini.getByRole('button', { name: 'Добавить средство' }).click();
  const search = mini.getByRole('searchbox', { name: 'Найти по названию или бренду' });
  await expect(search).toBeFocused();
  await search.fill('масло');
  const add = mini.getByRole('button', { name: 'Добавить', exact: true });
  await expect(add).toHaveCount(1);
  await add.click();
  await expect(search).toBeFocused();
  await search.fill('несуществующее средство');
  await expect(mini.getByText('Ничего не нашлось. Проверьте название')).toBeVisible();
  await mini.getByRole('button', { name: 'Закрыть' }).click();
  await expect(mini.getByText('Средства «Базовый уход» · 4')).toBeVisible();
  await mini.getByLabel('Цена «Базовый уход»').fill('4500');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();

  const variantsOnSite = async () => {
    const response = await request.get(`${API}/catalog/programs/pigmentation`);
    const body = (await response.json()) as {
      variants: { variant: string; priceKgs: number; itemCount: number }[];
    };
    return body.variants.map((v) => [v.variant, v.priceKgs, v.itemCount]);
  };
  expect(await variantsOnSite()).toEqual([
    ['mini', 4500, 4],
    ['standard', 6900, 5],
  ]);

  // Switched off and saved, the program is as before.
  await page.getByRole('switch', { name: 'Добавить «Базовый уход»' }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect.poll(variantsOnSite).toEqual([['standard', 6900, 5]]);
});

test('quiz lists: a skin type is added from the program editor, reaches the site, and is deleted', async ({
  request,
}) => {
  const answersOnSite = async () => {
    const response = await request.get(`${API}/catalog/quiz`);
    const body = (await response.json()) as { skins: { answer: string }[] };
    return body.skins.map((skin) => skin.answer);
  };
  await page.getByRole('link', { name: 'Программы' }).first().click();
  await page.getByRole('link', { name: 'Пигментация', exact: true }).click();
  await page.getByRole('link', { name: 'Изменить задачи и типы кожи' }).click();
  await expect(page).toHaveURL(/\/programs\/quiz$/);
  await expect(page.getByRole('region', { name: 'Задача 1' }).getByLabel('Название в админке')).toHaveValue(
    'Высыпания, чёрные точки, комедоны',
  );

  await page.getByRole('button', { name: 'Добавить тип кожи' }).click();
  const added = page.getByRole('region', { name: 'Тип кожи 6' });
  await added.getByLabel('Название в админке').fill('E2E кожа');
  await added.getByLabel('Ответ в тесте на сайте').fill('E2E: кожа после солнца');
  await added
    .getByRole('group', { name: 'Также подходят программы для' })
    .getByRole('button', { name: 'Сухая' })
    .click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();
  expect(await answersOnSite()).toContain('E2E: кожа после солнца');

  // Unused, so it goes without a question; the save removes it from the site.
  await added.getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByRole('region', { name: 'Тип кожи 6' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect.poll(answersOnSite).not.toContain('E2E: кожа после солнца');
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
