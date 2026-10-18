import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// WCAG 2.2 AA checks (plus label-in-name) with axe on the login screen and every admin screen. One login per run
// (rate limit).
test.describe.configure({ mode: 'serial' });
let page: Page;

test.beforeAll(async ({ browser }) => {
  // AxeBuilder needs a page from an explicit context.
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await page.context().close();
});

const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? 'owner@bom-beauty.com',
  password: process.env.SEED_OWNER_PASSWORD ?? 'change-me-please',
};

async function expectNoViolations(include?: string): Promise<void> {
  const builder = new AxeBuilder({ page }).options({
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'label-content-name-mismatch': { enabled: true } },
  });
  const { violations } = await (include ? builder.include(include) : builder).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('a11y: login', async () => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  await expectNoViolations();
  await page.getByLabel('Почта').fill(OWNER.email);
  await page.getByLabel('Пароль').fill(OWNER.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Доброе|Добрый|Доброй/);
});

const SCREENS = [
  '/',
  '/orders',
  '/leads',
  '/customers',
  '/products',
  '/products/new',
  '/programs',
  '/programs/new',
  '/wholesale',
  '/reviews',
  '/content/home',
  '/content/delivery',
  '/appearance',
  '/settings/shop',
  '/settings/seo',
  '/settings/notifications',
  '/settings/users',
  '/settings/security',
  '/settings/audit',
];

for (const path of SCREENS) {
  test(`a11y: ${path}`, async () => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoViolations();
  });
}

test('a11y: order drawer', async () => {
  await page.goto('/orders');
  await page.getByRole('row').nth(1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations('[role=dialog]');
});
