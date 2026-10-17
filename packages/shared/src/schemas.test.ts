import { describe, expect, it } from 'vitest';
import { splitAccent } from './schemas/content';
import { createOrderSchema } from './schemas/orders';
import { SETTING_DEFAULTS, SETTING_KEYS, SETTING_SCHEMAS } from './schemas/settings';

const valid = {
  clientRef: '0f8fad5b-d9cb-469f-a165-70867728950e',
  item: { type: 'program', slug: 'acne' },
  qty: 1,
  name: 'Айгерим',
  phone: '+996 555 12 34 56',
  address: 'Бишкек, ул. Токтогула 1',
  message: 'Здравствуйте!',
  pageUrl: 'https://bombeauty.kg/programs/acne',
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

  it('limits quantity to the stepper range', () => {
    expect(Object.keys(codes({ ...valid, qty: 10 }))).toEqual(['qty']);
    expect(Object.keys(codes({ ...valid, qty: 0 }))).toEqual(['qty']);
  });
});

describe('settings defaults', () => {
  it.each(SETTING_KEYS)('default "%s" passes its schema', (key) => {
    expect(SETTING_SCHEMAS[key].safeParse(SETTING_DEFAULTS[key]).success).toBe(true);
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
