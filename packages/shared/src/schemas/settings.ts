import { z } from 'zod';
import { FOREIGN_CURRENCY_CODES, type ForeignCurrencyCode } from '../currency';
import { THEME_KEYS } from '../enums';

// Setting values (docs/DATA-MODEL.md §3). M1 adds the remaining keys.

const hexColour = z.string().regex(/^#[0-9a-f]{6}$/i, 'colour.invalid');

export const appearanceSchema = z.object({
  theme: z.enum(THEME_KEYS),
  headerColor: hexColour,
  accentColor: hexColour,
});

const currencySetting = z.object({ enabled: z.boolean(), rate: z.number().positive('rate.positive') });

export const currenciesSchema = z.object(
  Object.fromEntries(FOREIGN_CURRENCY_CODES.map((code) => [code, currencySetting])) as Record<
    ForeignCurrencyCode,
    typeof currencySetting
  >,
);

export type CurrenciesSetting = z.infer<typeof currenciesSchema>;
