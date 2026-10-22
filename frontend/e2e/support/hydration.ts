import { expect, type Locator } from '@playwright/test';

/**
 * Waits until React has hydrated the element. Order buttons render as wa.me links first (so ordering works without
 * JavaScript), and a click that lands before hydration follows the link instead of updating the cart.
 */
export async function whenHydrated(locator: Locator): Promise<Locator> {
  await expect
    .poll(() => locator.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))))
    .toBe(true);
  return locator;
}
