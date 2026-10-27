import { describe, expect, it } from 'vitest';
import { splitAccent } from './text';
import { createOrderSchema, orderLinesOf } from './schemas/orders';
import { homeContentSchema, wholesaleContentSchema } from './schemas/content';
import { productInputSchema, settingKeyParamsSchema } from './schemas/admin-catalog';
import { SETTING_DEFAULTS, SETTING_KEYS, SETTING_SCHEMAS } from './schemas/settings';

const valid = {
  clientRef: '0f8fad5b-d9cb-469f-a165-70867728950e',
  items: [{ type: 'program', slug: 'acne', qty: 1 }],
  name: 'Айгерим',
  phone: '+996 555 12 34 56',
  address: 'Бишкек, ул. Токтогула 1',
  message: 'Здравствуйте!',
  pageUrl: 'https://bom-beauty.com/programs/acne',
};

const codes = (input: unknown): Record<string, string> => {
  const result = createOrderSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

describe('createOrderSchema', () => {
  it('accepts the design order form and defaults the currency to сом', () => {
    const parsed = createOrderSchema.parse(valid);
    expect(parsed.displayCurrency).toBe('KGS');
    expect(parsed.name).toBe('Айгерим');
  });

  it('uses the design validation codes', () => {
    expect(codes({ ...valid, name: ' А ', phone: '+996', address: 'Ош' })).toEqual({
      name: 'order.name.required',
      phone: 'order.phone.required',
      address: 'order.address.required',
    });
  });

  it('flags numbers that are long enough but invalid', () => {
    expect(codes({ ...valid, phone: '+996 000 000 000' })).toEqual({ phone: 'phone.invalid' });
  });

  it('limits a line to 1–20 and needs at least one line', () => {
    expect(Object.keys(codes({ ...valid, items: [{ type: 'product', slug: 'spf', qty: 21 }] }))).toEqual([
      'items.0.qty',
    ]);
    expect(Object.keys(codes({ ...valid, items: [{ type: 'product', slug: 'spf', qty: 0 }] }))).toEqual([
      'items.0.qty',
    ]);
    expect(codes({ ...valid, items: [] })).toEqual({ items: 'order.items.required' });
    const { items: _items, ...noItems } = valid;
    expect(codes(noItems)).toEqual({ items: 'order.items.required' });
  });

  it('still accepts the one-item shape from before the cart', () => {
    const { items: _items, ...rest } = valid;
    const parsed = createOrderSchema.parse({ ...rest, item: { type: 'product', slug: 'spf' }, qty: 3 });
    expect(orderLinesOf(parsed)).toEqual([{ type: 'product', slug: 'spf', qty: 3 }]);
  });

  it('merges repeated products and caps the quantity', () => {
    const parsed = createOrderSchema.parse({
      ...valid,
      items: [
        { type: 'product', slug: 'spf', qty: 15 },
        { type: 'product', slug: 'gel', qty: 1 },
        { type: 'product', slug: 'spf', qty: 9 },
      ],
    });
    expect(orderLinesOf(parsed)).toEqual([
      { type: 'product', slug: 'spf', qty: 20 },
      { type: 'product', slug: 'gel', qty: 1 },
    ]);
  });

  it('defaults to a WhatsApp order, so old outbox entries keep their meaning', () => {
    expect(createOrderSchema.parse(valid).paymentMethod).toBe('whatsapp');
    expect(createOrderSchema.parse({ ...valid, paymentMethod: 'finik' }).paymentMethod).toBe('finik');
    expect(codes({ ...valid, paymentMethod: 'cash' })).toHaveProperty('paymentMethod');
  });
});

describe('settings defaults', () => {
  it.each(SETTING_KEYS)('default "%s" passes its schema', (key) => {
    expect(SETTING_SCHEMAS[key].safeParse(SETTING_DEFAULTS[key]).success).toBe(true);
  });

  it('accepts every setting key in the admin route', () => {
    expect([...settingKeyParamsSchema.shape.key.options].sort()).toEqual([...SETTING_KEYS].sort());
  });

  it('keeps online payment off and requires the link placeholder', () => {
    expect(SETTING_DEFAULTS.payments.finikEnabled).toBe(false);
    const broken = {
      ...SETTING_DEFAULTS.payments,
      templates: { ...SETTING_DEFAULTS.payments.templates, link: 'Оплатите заказ' },
    };
    const result = SETTING_SCHEMAS.payments.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('payments.template.link');
  });
});

describe('home content', () => {
  it('reads comparison points saved as plain strings before the titled points', () => {
    const side = { eyebrow: 'Обычный', title: 'Масс-маркет', points: ['Временный эффект'] };
    const parsed = homeContentSchema.parse({
      heroTitle: 'Время *расцвета*',
      heroSubtitle: '',
      greetingVideoId: null,
      heroBadge: 'removed field',
      comparison: { title: 'vs', subtitle: '', mass: side, pro: side },
      about: { caption: '', text: '', stats: [] },
      reviewsTitle: '',
      reviewsSubtitle: '',
    });
    expect(parsed.comparison.mass.points).toEqual([{ title: 'Временный эффект', text: '' }]);
    expect(parsed.catalogImageMediaId).toBeNull();
    expect('heroBadge' in parsed).toBe(false);
  });
});

describe('product photos', () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const input = (photos: number) => ({
    name: 'Тонер',
    slug: '',
    shortName: null,
    brandName: 'Dr. SGN',
    categoryId: uuid(99),
    volume: '150 мл',
    priceKgs: 1500,
    purpose: '',
    description: '',
    howToUse: '',
    inci: null,
    badge: null,
    inStock: true,
    published: true,
    imageIds: Array.from({ length: photos }, (_, i) => uuid(i + 1)),
    seoTitle: null,
    seoDescription: null,
  });

  it('takes up to ten photos', () => {
    expect(productInputSchema.safeParse(input(10)).success).toBe(true);
    const result = productInputSchema.safeParse(input(11));
    expect(result.error?.issues[0]?.message).toBe('product.images.max');
  });
});

describe('wholesale content', () => {
  it('reads rows saved before the protocols PDF', () => {
    const parsed = wholesaleContentSchema.parse({
      phone: '',
      whatsapp: null,
      eyebrow: '',
      title: 'Опт',
      subtitle: '',
      facts: [],
      quote: '',
      intro: [],
      stats: [],
      expertise: [],
      featuredProductIds: [],
      benefits: [],
      steps: [],
      stockNote: '',
      delivery: [],
      catalogMediaId: null,
      videoId: null,
    });
    expect(parsed.protocolsMediaId).toBeNull();
  });
});

describe('splitAccent', () => {
  it('marks the accent word', () => {
    expect(splitAccent('Время *расцвета* и сияния вашей кожи')).toEqual([
      { text: 'Время ', accent: false },
      { text: 'расцвета', accent: true },
      { text: ' и сияния вашей кожи', accent: false },
    ]);
  });
});
