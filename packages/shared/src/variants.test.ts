import { describe, expect, it } from 'vitest';
import {
  PROGRAM_VARIANT_LABELS,
  PROGRAM_VARIANT_NOTES,
  orderLineLabel,
  orderSummary,
  withVariant,
} from './labels';
import { QUIZ_AGES, QUIZ_EXPERIENCES, type ProgramVariant } from './enums';
import { DEFAULT_QUIZ, recommendVariant } from './quiz';

const SKIN_TYPES = DEFAULT_QUIZ.skins.map((skin) => skin.key);
import {
  namedVariant,
  parseVariant,
  pickVariant,
  programCardVariants,
  programDetailVariants,
  variantOffers,
} from './variants';
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
          expect(
            recommendVariant({ goal: 'acne', skin, exp, age }, DEFAULT_QUIZ),
            `${skin} ${exp} ${age}`,
          ).toBe(TIER_OF[designTier({ skin, exp, age })]);
  });

  it('suggests «standard» before the answers are in', () => {
    expect(recommendVariant({}, DEFAULT_QUIZ)).toBe('standard');
  });
});

describe('variant labels', () => {
  it("names are the owner's (D48), notes verbatim from the design", () => {
    expect(PROGRAM_VARIANT_LABELS).toEqual({
      mini: 'Базовый уход',
      standard: 'Оптимальный уход',
      max: 'Интенсивный курс',
    });
    expect(PROGRAM_VARIANT_NOTES.max).toBe('Полная программа и усилители для быстрого результата');
  });

  it('adds the variant to order lines only when one was chosen', () => {
    expect(withVariant('Акне и постакне', 'mini')).toBe('Акне и постакне · Базовый уход');
    expect(withVariant('Акне и постакне', null)).toBe('Акне и постакне');
    expect(orderLineLabel({ title: 'Акне и постакне', qty: 2, variant: 'max' })).toBe(
      'Акне и постакне · Интенсивный курс × 2',
    );
    expect(orderSummary([{ title: 'Чёрные точки и поры', qty: 1, variant: 'standard' }])).toBe(
      'Чёрные точки и поры · Оптимальный уход',
    );
  });
});

describe('pickVariant (design: tierPick)', () => {
  const variants = [{ variant: 'mini' as const }, { variant: 'standard' as const }];

  it('takes the wanted variant, else «standard»', () => {
    expect(pickVariant(variants, 'mini').variant).toBe('mini');
    expect(pickVariant(variants, 'max').variant).toBe('standard');
    expect(pickVariant(variants, null).variant).toBe('standard');
  });

  it('names the variant only when the program has a choice', () => {
    expect(namedVariant(variants, 'standard')).toBe('standard');
    expect(namedVariant([{ variant: 'standard' }], 'standard')).toBeNull();
  });

  it('reads cached data without variants as «standard» only', () => {
    const { card, detail } = programProductsFixture();
    expect(programCardVariants({ ...card, variants: [] })).toEqual([
      {
        variant: 'standard',
        priceKgs: card.priceKgs,
        itemCount: card.itemCount,
        thumbs: card.thumbs,
        sumKgs: 0,
      },
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

describe('variantOffers (D48: every variant on the cards)', () => {
  it('lists each variant with its own price, count and crossed-out separate price', () => {
    const { card } = programProductsFixture();
    const priced: ProgramCard = {
      ...card,
      variants: [
        { variant: 'mini', priceKgs: 3900, itemCount: 2, thumbs: [], sumKgs: 4600 },
        { variant: 'standard', priceKgs: 5900, itemCount: 3, thumbs: [], sumKgs: 7400 },
        { variant: 'max', priceKgs: 9900, itemCount: 5, thumbs: [], sumKgs: 9900 },
      ],
    };
    expect(variantOffers(priced)).toEqual([
      { variant: 'mini', priceKgs: 3900, itemCount: 2, separatelyKgs: 4600 },
      { variant: 'standard', priceKgs: 5900, itemCount: 3, separatelyKgs: 7400 },
      { variant: 'max', priceKgs: 9900, itemCount: 5, separatelyKgs: 0 },
    ]);
  });

  it('crosses out nothing when the sum is unknown (cached data) or not above the price', () => {
    const { card } = programProductsFixture();
    expect(variantOffers({ ...card, variants: [] })).toEqual([
      { variant: 'standard', priceKgs: 5900, itemCount: 2, separatelyKgs: 0 },
    ]);
    expect(variantOffers(card).map((offer) => offer.separatelyKgs)).toEqual([0, 0]);
  });

  it('reads ?variant= from a card link', () => {
    expect(parseVariant('mini')).toBe('mini');
    expect(parseVariant('max')).toBe('max');
    expect(parseVariant('Мини')).toBeNull();
    expect(parseVariant(null)).toBeNull();
  });
});

/** A program with «mini» and «standard» for unit tests. */
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
      { variant: 'mini', priceKgs: 3900, itemCount: 1, thumbs: [thumb('foam')], sumKgs: 1500 },
      {
        variant: 'standard',
        priceKgs: 5900,
        itemCount: 2,
        thumbs: [thumb('foam'), thumb('cica')],
        sumKgs: 4000,
      },
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
