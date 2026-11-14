import { describe, expect, it } from 'vitest';
import { filterSearch, nameKey, normalizeSearch, rankSearch, type SearchField } from './search';

const cica = ['Cica-сыворотка восстанавливающая', 'Dr. SGN', 'Снимает покраснения', 'Сыворотки', '30 мл'];

/** Whether one item with these texts matches the query. */
const matches = (query: string, fields: readonly SearchField[]): boolean =>
  filterSearch([fields], query, (item) => item).length === 1;

interface Item {
  name: string;
  about?: string;
}
const names = (items: readonly Item[]) => items.map((item) => item.name);
const fieldsOf = (item: Item): SearchField[] => [item.name, { text: item.about, weight: 0.5 }];
const search = (items: readonly Item[], query: string) => {
  const { found, similar } = rankSearch(items, query, fieldsOf);
  return { found: names(found), similar: names(similar) };
};

describe('normalizeSearch', () => {
  it('drops case, punctuation and «ё»', () => {
    expect(normalizeSearch('  Dr.SGN / Ёлка!  ')).toBe('dr sgn елка');
  });
});

describe('search as typed', () => {
  it('matches everything on an empty query', () => {
    expect(matches('', cica)).toBe(true);
    expect(matches('  .  ', cica)).toBe(true);
  });

  it('finds by brand with or without punctuation and spaces', () => {
    expect(matches('dr sgn', cica)).toBe(true);
    expect(matches('Dr.SGN', cica)).toBe(true);
    expect(matches('drsgn', cica)).toBe(true);
  });

  it('needs every word, in any order', () => {
    expect(matches('сыворотка cica', cica)).toBe(true);
    expect(matches('сыворотка ronas', cica)).toBe(false);
  });

  it('accepts other case endings of Russian words', () => {
    expect(matches('сыворотки', cica)).toBe(true);
    expect(matches('восстанавливающий', cica)).toBe(true);
    expect(matches('покраснение', cica)).toBe(true);
    expect(matches('крем', cica)).toBe(false);
  });

  it('keeps short and other Latin words apart', () => {
    expect(matches('мл', cica)).toBe(true);
    expect(matches('tups', cica)).toBe(false);
    expect(matches('sgnbio', cica)).toBe(false);
  });

  it('skips empty fields', () => {
    expect(matches('тонер', ['Тонер', null, undefined, ''])).toBe(true);
  });
});

describe('search beyond the exact letters (owner request 2026-11-14)', () => {
  it('reads typos: one in a short word, two in a long one', () => {
    expect(matches('сывортка', cica)).toBe(true);
    expect(matches('сыворткаа', cica)).toBe(true);
    expect(matches('пинка', ['Пенка для умывания'])).toBe(true);
    expect(matches('покрансения', cica)).toBe(true);
    expect(matches('сварка', cica)).toBe(false);
    expect(matches('кот', ['Крем'])).toBe(false);
    expect(matches('порошок', ['Протокол для сухой кожи'])).toBe(false);
    expect(matches('cica', ['Упругость и сияние'])).toBe(false);
    expect(matches('креем', ['Крем'])).toBe(true);
  });

  it('reads typos only for a word nothing has as typed', () => {
    const items = [{ name: 'Маска для лица' }, { name: 'Массажный крем' }];
    expect(search(items, 'маска').found).toEqual(['Маска для лица']);
    expect(search(items, 'массаж').found).toEqual(['Массажный крем']);
  });

  it('meets the other alphabet halfway', () => {
    expect(matches('сика', cica)).toBe(true);
    expect(matches('цика', cica)).toBe(true);
    expect(matches('др сгн', cica)).toBe(true);
    expect(matches('krem', ['Крем для лица'])).toBe(true);
    expect(matches('syvorotka', cica)).toBe(true);
    expect(matches('селл бай селл', ['CELL BY CELL'])).toBe(true);
    expect(matches('ронас', ['Ronas'])).toBe(true);
    expect(matches('месаблю', ['MESABLUE'])).toBe(true);
  });

  it('reads a query typed in the other keyboard layout', () => {
    expect(matches('csdjhjnrf', cica)).toBe(true);
    expect(matches('сшсф', cica)).toBe(true);
    expect(matches('rhtv', ['Крем'])).toBe(true);
  });

  it('knows everyday words for problems and products', () => {
    expect(matches('прыщи', ['Акне и постакне'])).toBe(true);
    expect(matches('от прыщей', ['Высыпания, воспаления'])).toBe(true);
    expect(matches('морщинки', ['Антивозрастной крем'])).toBe(true);
    expect(matches('серум', cica)).toBe(true);
    expect(matches('санскрин', ['Солнцезащитный крем SPF 50'])).toBe(true);
    expect(matches('доктор сгн', cica)).toBe(true);
    expect(matches('прыщи', ['Увлажняющий крем'])).toBe(false);
  });

  it('skips filler words and never lets general ones hide an item', () => {
    expect(matches('крем для лица', ['Крем Cica'])).toBe(true);
    expect(matches('средство от покраснений', cica)).toBe(true);
    expect(matches('для', ['Крем для лица'])).toBe(true);
  });

  it('reads the Kyrgyz letters as Russian ones', () => {
    expect(matches('төнер', ['Тонер'])).toBe(true);
  });
});

describe('rankSearch', () => {
  const items: Item[] = [
    { name: 'Гель для умывания', about: 'Очищение' },
    { name: 'Сыворотка для сияния', about: 'Тусклая кожа' },
    { name: 'Крем для век', about: 'Морщинки вокруг глаз' },
    { name: 'Крем Cica', about: 'Акне и высыпания' },
    { name: 'Акне-крем', about: 'Точечное средство' },
  ];

  it('keeps every item in order on an empty query', () => {
    expect(search(items, '').found).toEqual(names(items));
  });

  it('puts the exact word first, then everyday words and less telling fields', () => {
    expect(search(items, 'акне').found).toEqual(['Акне-крем', 'Крем Cica']);
    expect(search(items, 'прыщи').found).toEqual(['Акне-крем', 'Крем Cica']);
    const pair = [{ name: 'Крем от высыпаний' }, { name: 'Крем от прыщей' }];
    expect(search(pair, 'прыщи').found).toEqual(['Крем от прыщей', 'Крем от высыпаний']);
    expect(search(pair, 'прыщей крем').found).toEqual(['Крем от прыщей', 'Крем от высыпаний']);
    expect(search(items, 'крем').found).toEqual(['Крем для век', 'Крем Cica', 'Акне-крем']);
  });

  it('offers the closest items when no item has every word of a longer query', () => {
    expect(search(items, 'крем от морщин и прыщей для шеи')).toEqual({
      found: [],
      similar: ['Акне-крем', 'Крем для век', 'Крем Cica'],
    });
    expect(search(items, 'тоник вокруг шеи')).toEqual({ found: [], similar: [] });
  });

  it('offers nothing similar for one unknown word', () => {
    expect(search(items, 'маникюр')).toEqual({ found: [], similar: [] });
  });

  it('limits the similar items', () => {
    expect(rankSearch(items, 'крем от морщин и прыщей для шеи', fieldsOf, 1).similar).toHaveLength(1);
  });
});

describe('filterSearch', () => {
  it('keeps the list order', () => {
    const items = [{ name: 'Акне-крем' }, { name: 'Гель' }, { name: 'Крем Cica', about: 'Акне' }];
    expect(names(filterSearch(items, 'акне', fieldsOf))).toEqual(['Акне-крем', 'Крем Cica']);
  });
});

describe('nameKey', () => {
  it('treats names that differ in case, spaces or punctuation as one', () => {
    expect(nameKey('Dr. SGN')).toBe(nameKey('Dr.SGN'));
    expect(nameKey('dr sgn')).toBe(nameKey('DR-SGN'));
    expect(nameKey('Сыворотки')).toBe(nameKey(' сыворотки. '));
  });

  it('keeps different names apart', () => {
    expect(nameKey('TUPS')).not.toBe(nameKey('TUPS Laboratories'));
    expect(nameKey('Dr. SGN')).not.toBe(nameKey('Dr. SGNBIO'));
  });
});
