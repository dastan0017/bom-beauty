import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, normalizePhone } from './phone';
import { itemsWord, productsWord, stepsWord } from './plural';
import { slugify } from './slug';

describe('phone', () => {
  it('normalises Kyrgyz numbers with or without the country code', () => {
    expect(normalizePhone('+996 706 304 803')).toBe('+996706304803');
    expect(normalizePhone('0706 304 803')).toBe('+996706304803');
  });

  it('accepts international numbers and rejects junk', () => {
    expect(normalizePhone('+7 701 334 12 08')).toBe('+77013341208');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('formats Kyrgyz numbers like the design footer', () => {
    expect(formatPhoneDisplay('+996706304803')).toBe('+996 706 30 48 03');
  });
});

describe('plural', () => {
  it.each([
    [1, 'средство'],
    [3, 'средства'],
    [5, 'средств'],
    [11, 'средств'],
    [21, 'средство'],
    [22, 'средства'],
  ])('%i → %s', (n, word) => expect(productsWord(n)).toBe(word));

  it('steps', () => expect(stepsWord(3)).toBe('шага'));

  it.each([
    [1, 'товар'],
    [2, 'товара'],
    [4, 'товара'],
    [5, 'товаров'],
    [11, 'товаров'],
    [14, 'товаров'],
    [20, 'товаров'],
    [21, 'товар'],
    [22, 'товара'],
  ])('cart units: %i → %s', (n, word) => expect(itemsWord(n)).toBe(word));
});

describe('slugify', () => {
  it('transliterates Russian and Kyrgyz', () => {
    expect(slugify('Акне и проблемная кожа')).toBe('akne-i-problemnaya-kozha');
    expect(slugify('Өмүр Үсөн')).toBe('omur-uson');
    expect(slugify('PDRN Perfect Ampoule')).toBe('pdrn-perfect-ampoule');
  });
});
