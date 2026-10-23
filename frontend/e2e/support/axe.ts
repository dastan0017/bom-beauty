import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** WCAG 2.2 AA with axe, plus label-in-name (Lighthouse runs it too); `include` limits the check to one part. */
export async function expectNoViolations(page: Page, include?: string): Promise<void> {
  const builder = new AxeBuilder({ page }).options({
    runOnly: { type: 'tag', values: TAGS },
    rules: { 'label-content-name-mismatch': { enabled: true } },
  });
  const { violations } = await (include ? builder.include(include) : builder).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
