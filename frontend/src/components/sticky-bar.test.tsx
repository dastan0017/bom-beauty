import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StickyBar } from './sticky-bar';

// iOS 26 Safari can lift `bottom: 0` above the screen edge while its toolbar is minimized; the bar must cover that gap.
describe('StickyBar', () => {
  const html = renderToStaticMarkup(<StickyBar>Заказать</StickyBar>);

  it('is opaque, so Safari can tint its toolbar from it and nothing shows through', () => {
    expect(html).toMatch(/data-sticky-bar="all" class="[^"]*\bbg-white\b/);
    expect(html).not.toMatch(/bg-white\/\d+/);
  });

  it('carries a filler of its own colour below itself', () => {
    expect(html).toMatch(
      /<span aria-hidden="true" data-sticky-filler="" class="[^"]*\btop-full\b[^"]*\bbg-white\b/,
    );
  });
});
