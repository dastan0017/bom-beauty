import { describe, expect, it } from 'vitest';
import {
  PROGRAM_VARIANT_LABELS,
  PROGRAM_VARIANT_NOTES,
  orderLineLabel,
  orderSummary,
  withVariant,
} from './labels';
import { QUIZ_AGES, QUIZ_EXPERIENCES, SKIN_TYPES, type ProgramVariant } from './enums';
import { recommendVariant } from './quiz';
import { namedVariant, pickVariant, programCardVariants, programDetailVariants } from './variants';
import { createOrderSchema, orderLinesOf } from './schemas/orders';
import { programInputSchema } from './schemas/admin-catalog';
import type { ProgramCard, ProgramDetail } from './schemas/catalog';

/** The design's recTier, transcribed from the prototype as the reference (base / opt / max). */
function designTier(a: { skin: string; exp: string; age: string }): 'base' | 'opt' | 'max' {
  const k = a.exp === 'new' ? 'base' : a.exp === 'pro' || a.age === '35' || a.age === '45' ? 'max' : 'opt';
  return k === 'max' && a.skin === 'sens' ? 'opt' : k;
}
const TIER_OF: Record<'base' | 'opt' | 'max', ProgramVariant> = { base: 'mini', opt: 'standard', max: 'max' };

describe('recommendVariant', () => {
  it('matches the prototype for every skin, experience and age', () => {
    for (const skin of SKIN_TYPES)
      for (const exp of QUIZ_EXPERIENCES)
        for (const age of QUIZ_AGES)
          expect(recommendVariant({ goal: 'acne', skin, exp, age }), `${skin} ${exp} ${age}`).toBe(
            TIER_OF[designTier({ skin, exp, age })],
          );
  });

  it('suggests «Стандарт» before the answers are in', () => {
    expect(recommendVariant({})).toBe('standard');
  });
});

describe('variant labels', () => {
  it('names and notes are verbatim from the design', () => {
    expect(PROGRAM_VARIANT_LABELS).toEqual({ mini: 'Мини', standard: 'Стандарт', max: 'Максимум' });
    expect(PROGRAM_VARIANT_NOTES.max).toBe('Полная программа и усилители для быстрого результата');
  });

  it('adds the variant to order lines only when one was chosen', () => {
    expect(withVariant('Акне и постакне', 'mini')).toBe('Акне и постакне · Мини');
    expect(withVariant('Акне и постакне', null)).toBe('Акне и постакне');
    expect(orderLineLabel({ title: 'Акне и постакне', qty: 2, variant: 'max' })).toBe(
      'Акне и постакне · Максимум × 2',
    );
    expect(orderSummary([{ title: 'Чёрные точки и поры', qty: 1, variant: 'standard' }])).toBe(
      'Чёрные точки и поры · Стандарт',
    );
  });
});

describe('pickVariant (design: tierPick)', () => {
  const variants = [{ variant: 'mini' as const }, { variant: 'standard' as const }];

  it('takes the wanted variant, else «Стандарт»', () => {
    expect(pickVariant(variants, 'mini').variant).toBe('mini');
    expect(pickVariant(variants, 'max').variant).toBe('standard');
    expect(pickVariant(variants, null).variant).toBe('standard');
  });

  it('names the variant only when the program has a choice', () => {
    expect(namedVariant(variants, 'standard')).toBe('standard');
    expect(namedVariant([{ variant: 'standard' }], 'standard')).toBeNull();
  });

  it('reads cached data without variants as «Стандарт» only', () => {
    const { card, detail } = programProductsFixture();
    expect(programCardVariants({ ...card, variants: [] })).toEqual([
      { variant: 'standard', priceKgs: card.priceKgs, itemCount: card.itemCount, thumbs: card.thumbs },
    ]);
    expect(programDetailVariants({ ...detail, variants: [] })[0]?.items).toEqual(detail.items);
    expect(programCardVariants(card)).toBe(card.variants);
  });
});

describe('orders with variants', () => {
  const order = {
    clientRef: '0f8fad5b-d9cb-469f-a165-70867728950e',
    name: 'Айгерим',
    phone: '+996 555 12 34 56',
    address: 'Бишкек, ул. Токтогула 1',
    message: 'Здравствуйте!',
    pageUrl: 'https://bom-beauty.com/programs/acne',
  };

  it('keeps different variants of one program apart and merges the same one', () => {
    const parsed = createOrderSchema.parse({
      ...order,
      items: [
        { type: 'program', slug: 'acne', qty: 1, variant: 'mini' },
        { type: 'program', slug: 'acne', qty: 1, variant: 'max' },
        { type: 'program', slug: 'acne', qty: 1, variant: 'mini' },
        { type: 'program', slug: 'acne', qty: 1 },
        { type: 'program', slug: 'acne', qty: 1, variant: 'standard' },
      ],
    });
    expect(orderLinesOf(parsed)).toEqual([
      { type: 'program', slug: 'acne', qty: 2, variant: 'mini' },
      { type: 'program', slug: 'acne', qty: 1, variant: 'max' },
      { type: 'program', slug: 'acne', qty: 2 },
    ]);
  });

  it('refuses an unknown variant', () => {
    const parsed = createOrderSchema.safeParse({
      ...order,
      items: [{ type: 'program', slug: 'acne', qty: 1, variant: 'big' }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('program input variants', () => {
  const base = {
    title: 'Акне',
    slug: '',
    headline: null,
    symptom: '',
    description: '',
    course: '',
    fit: [],
    priceKgs: 5900,
    badge: null,
    quizGoal: null,
    quizSkins: [],
    published: true,
    inStock: true,
    itemIds: [],
    steps: { am: [], pm: [] },
    videoId: null,
    protocolMediaId: null,
    seoTitle: null,
    seoDescription: null,
  };
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const codes = (input: unknown) => {
    const parsed = programInputSchema.safeParse(input);
    return parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
  };

  it('defaults to no variants (older admin builds send none)', () => {
    expect(programInputSchema.parse(base).variants).toEqual({ mini: null, max: null });
  });

  it('needs a price and at least one product for each variant', () => {
    expect(codes({ ...base, variants: { mini: { itemIds: [], priceKgs: 0 }, max: null } })).toEqual({
      'variants.mini.itemIds': 'program.variant.items.required',
      'variants.mini.priceKgs': 'price.required',
    });
    expect(codes({ ...base, variants: { mini: null, max: { itemIds: [id], priceKgs: 10500 } } })).toEqual({});
  });
});

/** A program with «Мини» and «Стандарт» for unit tests. */
export function programProductsFixture(): { card: ProgramCard; detail: ProgramDetail } {
  const thumb = (slug: string) => ({ slug, image: null });
  const product = (slug: string, priceKgs: number) => ({
    id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    slug,
    name: slug,
    shortName: slug,
    brand: 'Dr. SGN',
    category: { slug: 'serums', name: 'Сыворотки' },
    volume: '50 мл',
    purpose: '',
    priceKgs,
    badge: null,
    inStock: true,
    bestseller: false,
    seoulChoice: false,
    isNew: false,
    image: null,
    video: null,
  });
  const card: ProgramCard = {
    id: '1f8fad5b-d9cb-469f-a165-70867728950e',
    slug: 'acne',
    title: 'Акне и постакне',
    symptom: '',
    badge: null,
    priceKgs: 5900,
    inStock: true,
    itemCount: 2,
    thumbs: [thumb('foam'), thumb('cica')],
    variants: [
      { variant: 'mini', priceKgs: 3900, itemCount: 1, thumbs: [thumb('foam')] },
      { variant: 'standard', priceKgs: 5900, itemCount: 2, thumbs: [thumb('foam'), thumb('cica')] },
    ],
    cover: null,
    video: null,
    quiz: { goal: 'acne', skins: [] },
  };
  const items = [product('foam', 1500), product('cica', 2500)];
  const detail: ProgramDetail = {
    ...card,
    headline: null,
    course: '',
    fit: [],
    description: '',
    items,
    sumKgs: 4000,
    variants: [
      {
        variant: 'mini',
        priceKgs: 3900,
        itemCount: 1,
        thumbs: [thumb('foam')],
        items: items.slice(0, 1),
        sumKgs: 1500,
      },
      { variant: 'standard', priceKgs: 5900, itemCount: 2, thumbs: card.thumbs, items, sumKgs: 4000 },
    ],
    steps: { am: [], pm: [] },
    video: null,
    protocol: null,
    seo: { title: null, description: null },
    updatedAt: '2026-11-10T00:00:00.000Z',
  };
  return { card, detail };
}
