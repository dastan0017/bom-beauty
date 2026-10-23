import { expect, test } from '@playwright/test';
import { expectNoViolations } from './support/axe';
import { whenHydrated } from './support/hydration';
import { addReviews } from './support/reviews';

// WCAG 2.2 AA checks with axe on every page type and on the overlays (order sheet, quiz), plus label-in-name, which
// Lighthouse also runs. Two review screenshots are added first so the home slider is checked too.

let removeReviews: (() => Promise<void>) | undefined;
test.beforeAll(async ({}, testInfo) => {
  // One project uploads; both see the reviews (the run is not parallel).
  if (testInfo.project.name === 'phone') removeReviews = await addReviews(2);
});
test.afterAll(async () => {
  await removeReviews?.();
});

const PAGES = [
  '/',
  '/catalog',
  '/catalog?category=serums',
  '/catalog?problem=acne',
  '/catalog/dr-sgn-cica-serum',
  '/programs',
  '/programs/acne',
  '/wholesale',
  '/delivery',
  '/privacy',
  '/offer',
  '/no-such-page',
];

for (const path of PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoViolations(page);
  });
}

test('a11y: home with the reviews slider', async ({ page }) => {
  // The site picks the new reviews up once the API's revalidation reaches it.
  await expect(async () => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Отзыв 1 из/ })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expectNoViolations(page);
});

test('a11y: order sheet', async ({ page }) => {
  await page.goto('/catalog');
  await (await whenHydrated(page.getByRole('button', { name: 'В корзину' }).first())).click();
  await expectNoViolations(page);
  await page.getByRole('button', { name: /Оформить/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Отправить заказ в WhatsApp' }).click();
  await expect(sheet.getByText('Как к вам обращаться?')).toBeVisible();
  await expectNoViolations(page, '[role=dialog]');
});

test('a11y: quiz question and result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Подобрать программу ухода за 1 минуту' }).click();
  const quiz = page.getByRole('dialog', { name: 'Подобрать программу ухода за 1 минуту' });
  await expect(quiz).toBeVisible();
  await expectNoViolations(page, '[role=dialog]');
  for (const answer of ['Снять красноту', 'Кожа краснеет', 'Почти не пользовалась', '45+ лет']) {
    await quiz.getByRole('button', { name: answer }).click();
  }
  await expect(quiz.getByRole('heading', { name: 'Отлично!' })).toBeVisible();
  await expectNoViolations(page, '[role=dialog]');
});

test.describe('keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard paths are checked on desktop');

  test('order sheet: opens from the keyboard, keeps focus inside, Escape returns focus', async ({ page }) => {
    await page.goto('/catalog');
    await (await whenHydrated(page.getByRole('button', { name: 'В корзину' }).first())).click();
    const trigger = page.getByRole('button', { name: /Оформить/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'Оформление заказа' });
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('quiz: answers with the keyboard and closes with Escape', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('link', { name: 'Подобрать программу ухода за 1 минуту' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const quiz = page.getByRole('dialog', { name: 'Подобрать программу ухода за 1 минуту' });
    await expect(quiz).toBeVisible();
    const answer = quiz.getByRole('button', { name: 'Избавиться от высыпаний' });
    await answer.focus();
    await page.keyboard.press('Enter');
    await expect(quiz.getByRole('button', { name: 'Появляется сильный жирный блеск' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(quiz).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
