import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearch } from './search';

const cica = ['Cica-сыворотка восстанавливающая', 'Dr. SGN', 'Снимает покраснения', 'Сыворотки', '30 мл'];

describe('normalizeSearch', () => {
  it('drops case, punctuation and «ё»', () => {
    expect(normalizeSearch('  Dr.SGN / Ёлка!  ')).toBe('dr sgn елка');
  });
});

describe('matchesSearch', () => {
  it('matches everything on an empty query', () => {
    expect(matchesSearch('', cica)).toBe(true);
    expect(matchesSearch('  .  ', cica)).toBe(true);
  });

  it('finds by brand with or without punctuation and spaces', () => {
    expect(matchesSearch('dr sgn', cica)).toBe(true);
    expect(matchesSearch('Dr.SGN', cica)).toBe(true);
    expect(matchesSearch('drsgn', cica)).toBe(true);
  });

  it('needs every word, in any order', () => {
    expect(matchesSearch('сыворотка cica', cica)).toBe(true);
    expect(matchesSearch('сыворотка ronas', cica)).toBe(false);
  });

  it('accepts other case endings of Russian words', () => {
    expect(matchesSearch('сыворотки', cica)).toBe(true);
    expect(matchesSearch('восстанавливающий', cica)).toBe(true);
    expect(matchesSearch('покраснение', cica)).toBe(true);
    expect(matchesSearch('крем', cica)).toBe(false);
  });

  it('keeps short and Latin words whole', () => {
    expect(matchesSearch('мл', cica)).toBe(true);
    expect(matchesSearch('tups', cica)).toBe(false);
    expect(matchesSearch('sgnbio', cica)).toBe(false);
  });

  it('skips empty fields', () => {
    expect(matchesSearch('тонер', ['Тонер', null, undefined, ''])).toBe(true);
  });
});
