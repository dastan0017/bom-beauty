import type { CurrencyCode } from './enums';
import { groupThousands } from './money';

export interface CurrencyDefinition {
  code: CurrencyCode;
  symbol: string;
  label: string;
  /** Converted prices are rounded to a multiple of this. */
  step: number;
  /** true: the rate is quoted as сом per 1 unit (USD, EUR); false: units per 1 сом. */
  inverse: boolean;
  /** Default rate from the design, used until the owner sets one. */
  defaultRate: number;
}

// Port of CURS / RATE0 in design/Bom Beauty Prototype.dc.html.
export const CURRENCIES: Record<CurrencyCode, CurrencyDefinition> = {
  KGS: { code: 'KGS', symbol: 'сом', label: 'Сом', step: 1, inverse: false, defaultRate: 1 },
  USD: { code: 'USD', symbol: '$', label: 'Доллар', step: 1, inverse: true, defaultRate: 87.4 },
  RUB: { code: 'RUB', symbol: '₽', label: 'Рубль', step: 10, inverse: false, defaultRate: 0.93 },
  EUR: { code: 'EUR', symbol: '€', label: 'Евро', step: 1, inverse: true, defaultRate: 102 },
  KZT: { code: 'KZT', symbol: '₸', label: 'Тенге', step: 10, inverse: false, defaultRate: 6 },
  UZS: { code: 'UZS', symbol: 'сум', label: 'Сум', step: 1000, inverse: false, defaultRate: 140 },
  KRW: { code: 'KRW', symbol: '₩', label: 'Вона', step: 100, inverse: false, defaultRate: 16 },
};

export const FOREIGN_CURRENCY_CODES = [
  'USD',
  'RUB',
  'EUR',
  'KZT',
  'UZS',
  'KRW',
] as const satisfies readonly CurrencyCode[];
export type ForeignCurrencyCode = (typeof FOREIGN_CURRENCY_CODES)[number];

/** How many units of `code` one сом buys, given the owner's quoted rate. */
export function kgsMultiplier(code: CurrencyCode, rate?: number): number {
  if (code === 'KGS') return 1;
  const def = CURRENCIES[code];
  const quoted = rate !== undefined && rate > 0 ? rate : def.defaultRate;
  return def.inverse ? 1 / quoted : quoted;
}

/** Converts a сом amount and rounds it to the currency's step (never below one step). */
export function convertFromKgs(kgs: number, code: CurrencyCode, rate?: number): number {
  if (code === 'KGS') return kgs;
  const { step } = CURRENCIES[code];
  return Math.max(step, Math.round((kgs * kgsMultiplier(code, rate)) / step) * step);
}

/** "68 $", "35 400 ₸" */
export function formatMoney(amount: number, code: CurrencyCode): string {
  return `${groupThousands(amount)}\u00a0${CURRENCIES[code].symbol}`;
}

/** Formats a сом price in the given currency. */
export function formatPrice(kgs: number, code: CurrencyCode = 'KGS', rate?: number): string {
  return formatMoney(convertFromKgs(kgs, code, rate), code);
}
