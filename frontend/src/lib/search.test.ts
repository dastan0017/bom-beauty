import type { ProductCard, ProgramCard } from '@bom/shared';
import { describe, expect, it } from 'vitest';
import { searchHref } from '../components/search-box';
import { searchProducts, searchPrograms } from './search';

const program = (
  slug: string,
  title: string,
  symptom: string,
  items: string[],
  extra: string[] = [],
): ProgramCard => ({
  id: '1f8fad5b-d9cb-469f-a165-70867728950e',
  slug,
  title,
  symptom,
  badge: null,
  priceKgs: 5900,
  inStock: true,
  itemCount: items.length,
  thumbs: items.map((item) => ({ slug: item, image: null })),
  variants: [
    {
      variant: 'standard',
      priceKgs: 5900,
      itemCount: items.length,
      thumbs: items.map((item) => ({ slug: item, image: null })),
      sumKgs: 0,
    },
    ...(extra.length
      ? [
          {
            variant: 'max' as const,
            priceKgs: 9900,
            itemCount: extra.length,
            thumbs: extra.map((item) => ({ slug: item, image: null })),
            sumKgs: 0,
          },
        ]
      : []),
  ],
  cover: null,
  video: null,
  quiz: { goal: null, skins: [] },
});

const programs = [
  program('acne', 'Акне и постакне', 'Воспаления, высыпания и следы постакне', ['foam', 'cica'], ['pdrn']),
  program('pigmentation', 'Пигментация', 'Пятна после солнца', ['wserum']),
];
const products = [
  { slug: 'foam', name: 'Пенка для умывания с центеллой', shortName: 'Пенка', brand: 'Dr. SGN' },
  { slug: 'cica', name: 'Успокаивающая cica-сыворотка', shortName: 'Cica-сыворотка', brand: 'Dr. SGN' },
  { slug: 'pdrn', name: 'PDRN Perfect Ampoule', shortName: 'PDRN-ампула', brand: 'Dr. SGN' },
  { slug: 'wserum', name: 'Осветляющая сыворотка', shortName: 'Сыворотка', brand: 'Merikit' },
];
const slugs = (query: string) => searchPrograms(programs, products, query).found.map((p) => p.slug);

describe('searchPrograms (programs page search)', () => {
  it('keeps every program for an empty query', () => {
    expect(slugs('  ')).toEqual(['acne', 'pigmentation']);
  });

  it('finds a program by its title or symptoms, with Russian endings', () => {
    expect(slugs('акне')).toEqual(['acne']);
    expect(slugs('пятно')).toEqual(['pigmentation']);
  });

  it('finds a program by a product it lists, in any variant, or by brand', () => {
    expect(slugs('пенку')).toEqual(['acne']);
    expect(slugs('pdrn')).toEqual(['acne']);
    expect(slugs('сыворотка')).toEqual(['acne', 'pigmentation']);
    expect(slugs('merikit')).toEqual(['pigmentation']);
  });

  it('needs every word of the query', () => {
    expect(slugs('акне сыворотка')).toEqual(['acne']);
    expect(slugs('акне солнца')).toEqual([]);
  });

  it('reads typos, the other alphabet and everyday words (D53)', () => {
    expect(slugs('пинка')).toEqual(['acne']);
    expect(slugs('пдрн')).toEqual(['acne']);
    expect(slugs('прыщи')).toEqual(['acne']);
    expect(slugs('мерикит')).toEqual(['pigmentation']);
  });

  it('ranks the program named by the query first', () => {
    expect(slugs('сыворотка пятна')).toEqual(['pigmentation']);
    expect(slugs('сыворотка')).toEqual(['acne', 'pigmentation']);
    expect(slugs('пигментация')).toEqual(['pigmentation']);
    expect(slugs('высыпания')).toEqual(['acne']);
  });

  it('offers the closest programs when none has every word', () => {
    expect(searchPrograms(programs, products, 'акне маникюр педикюр').similar.map((p) => p.slug)).toEqual([]);
    expect(searchPrograms(programs, products, 'пенка от пятен').similar.map((p) => p.slug)).toEqual([
      'pigmentation',
      'acne',
    ]);
  });
});

const card = (slug: string, name: string, brand: string, category: string): ProductCard => ({
  id: '1f8fad5b-d9cb-469f-a165-70867728950e',
  slug,
  name,
  shortName: name,
  brand,
  category: { slug: category, name: category },
  volume: '150 мл',
  purpose: '',
  priceKgs: 1000,
  badge: null,
  inStock: true,
  bestseller: false,
  seoulChoice: false,
  isNew: false,
  image: null,
  video: null,
});

describe('searchProducts (catalog search)', () => {
  const catalog = [
    card('foam', 'Пенка для умывания с центеллой', 'Dr. SGN', 'Очищение'),
    card('cica', 'Успокаивающая cica-сыворотка', 'Dr. SGN', 'Сыворотки'),
    card('pdrn', 'PDRN Perfect Ampoule', 'Dr. SGN', 'Сыворотки'),
    card('wserum', 'Осветляющая сыворотка', 'Merikit', 'Сыворотки'),
    card('acne-serum', 'Сыворотка от акне', 'Merikit', 'Сыворотки'),
  ];
  const found = (query: string) => searchProducts(catalog, programs, query).found.map((p) => p.slug);

  it('finds a product by a problem its programs treat, after the products named for it', () => {
    expect(found('акне')).toEqual(['acne-serum', 'foam', 'cica', 'pdrn']);
    expect(found('пятна')).toEqual(['wserum']);
  });

  it('keeps the catalog order for an empty query', () => {
    expect(found('')).toEqual(catalog.map((p) => p.slug));
  });

  it('reads typos and the other keyboard layout', () => {
    expect(found('сывортка')).toEqual(['cica', 'wserum', 'acne-serum', 'pdrn']);
    expect(found('gtyrf')).toEqual(['foam']);
  });
});

describe('searchHref', () => {
  it('keeps the other parameters in order and leaves out empty ones', () => {
    expect(searchHref('/catalog', { problem: 'acne', category: undefined, brand: 'dr-sgn' }, ' пенка ')).toBe(
      '/catalog?problem=acne&brand=dr-sgn&q=%D0%BF%D0%B5%D0%BD%D0%BA%D0%B0',
    );
    expect(searchHref('/programs', {}, '')).toBe('/programs');
  });
});
