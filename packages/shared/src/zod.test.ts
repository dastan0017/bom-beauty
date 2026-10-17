import { afterEach, describe, expect, it, vi } from 'vitest';

describe('zod in browsers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds and runs the schemas without probing eval, which the apps’ CSPs block', async () => {
    vi.stubGlobal('window', globalThis);
    const probe = vi.spyOn(globalThis, 'Function');
    const { createOrderSchema } = await import('./index');
    createOrderSchema.safeParse({ name: 'Тест' });
    expect(probe).not.toHaveBeenCalled();
  });
});
