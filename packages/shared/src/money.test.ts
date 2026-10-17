import { describe, expect, it } from 'vitest';
import { convertFromKgs, formatMoney, formatPrice } from './currency';
import { formatKgs, groupThousands } from './money';

const NBSP = '\u00a0';

describe('money', () => {
  it('groups thousands with a no-break space', () => {
    expect(groupThousands(5900)).toBe(`5${NBSP}900`);
    expect(groupThousands(1184600)).toBe(`1${NBSP}184${NBSP}600`);
    expect(groupThousands(950)).toBe('950');
  });

  it('formats сом like the design', () => {
    expect(formatKgs(3900)).toBe(`3${NBSP}900${NBSP}сом`);
  });
});

describe('currency', () => {
  // Expected values match the admin's "Например, программа: 5 900 сом = …" line with the default rates.
  it.each([
    ['USD', 68],
    ['RUB', 5490],
    ['EUR', 58],
    ['KZT', 35400],
    ['UZS', 826000],
    ['KRW', 94400],
  ] as const)('converts 5 900 сом to %s with the default rate', (code, expected) => {
    expect(convertFromKgs(5900, code)).toBe(expected);
  });

  it('uses the owner rate when given and never rounds below one step', () => {
    expect(convertFromKgs(5900, 'USD', 90)).toBe(66);
    expect(convertFromKgs(10, 'UZS')).toBe(1000);
    expect(convertFromKgs(5900, 'KGS', 123)).toBe(5900);
  });

  it('formats foreign prices with the currency symbol', () => {
    expect(formatMoney(35400, 'KZT')).toBe(`35${NBSP}400${NBSP}₸`);
    expect(formatPrice(5900, 'USD')).toBe(`68${NBSP}$`);
  });
});
