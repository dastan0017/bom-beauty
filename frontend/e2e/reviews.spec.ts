import { expect, test, type Locator, type Page } from '@playwright/test';
import { addReviews } from './support/reviews';

// The review lightbox on a phone: a finger swipe moves between screenshots, like the arrows do.

let removeReviews: (() => Promise<void>) | undefined;
test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name === 'phone') removeReviews = await addReviews(3);
});
test.afterAll(async () => {
  await removeReviews?.();
});

/**
 * A real touch drag across the track (Chromium's synthetic gesture, without a fling), `dx` px to the right. Waits for
 * the snap to finish, since a drag that starts mid-snap is measured from wherever the snap stopped.
 */
async function swipe(page: Page, target: Locator, dx: number): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('swipe target is not visible');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
    xDistance: dx,
    yDistance: 0,
    gestureSourceType: 'touch',
    speed: 1200,
  });
  await cdp.detach();
  await expect
    .poll(() => target.evaluate((node) => node.scrollLeft % node.clientWidth))
    .toBeLessThan(1);
}

test('review lightbox: swipe and arrows move between reviews', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'swiping is a touch gesture');
  // The site picks the new reviews up once the API's revalidation reaches it.
  await expect(async () => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Отзыв 1 из/ })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  await page.getByRole('button', { name: /Отзыв 1 из/ }).click();
  await expect(page.getByRole('dialog', { name: /^Отзыв 1 из/ })).toBeVisible();
  const track = page.getByTestId('review-track');

  await swipe(page, track, -260);
  await expect(page.getByRole('dialog', { name: /^Отзыв 2 из/ })).toBeVisible();
  await swipe(page, track, -260);
  await expect(page.getByRole('dialog', { name: /^Отзыв 3 из/ })).toBeVisible();
  await swipe(page, track, 260);
  await expect(page.getByRole('dialog', { name: /^Отзыв 2 из/ })).toBeVisible();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Следующий отзыв' }).click();
  await expect(page.getByRole('dialog', { name: /^Отзыв 3 из/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Предыдущий отзыв' }).click();
  await expect(page.getByRole('dialog', { name: /^Отзыв 2 из/ })).toBeVisible();
});
