import { z } from 'zod';
import { FOREIGN_CURRENCY_CODES, type ForeignCurrencyCode, CURRENCIES } from '../currency';
import { CURRENCY_CODES, THEME_KEYS } from '../enums';
import { normalizePhone } from '../phone';
import { DEFAULT_APPEARANCE } from '../theme';
import { imageRefSchema } from './common';

// Setting values (docs/DATA-MODEL.md §3). Stored values are merged over these defaults on read.

const hexColour = z.string().regex(/^#[0-9a-f]{6}$/i, 'colour.invalid');
const e164 = z.string().refine((value) => normalizePhone(value) === value, 'phone.invalid');
const optionalText = z.string().trim().max(500).nullable();

export const shopSettingSchema = z.object({
  name: z.string().trim().min(1).max(100),
  whatsapp: e164,
  instagramShop: z.string().trim().max(100),
  instagramOwner: z.string().trim().max(100),
  ownerName: z.string().trim().max(100),
  legalLine: z.string().trim().max(200),
  footerNote: z.string().trim().max(300),
});

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

export const notificationsSettingSchema = z.object({
  telegramEnabled: z.boolean(),
  telegramChatId: optionalText,
  emailEnabled: z.boolean(),
  email: z.email().nullable(),
  notifyLeads: z.boolean(),
});

export const seoSettingSchema = z.object({
  defaultTitle: z.string().trim().max(200),
  defaultDescription: z.string().trim().max(500),
  ogMediaId: z.uuid().nullable(),
  googleVerification: optionalText,
  yandexVerification: optionalText,
});

export const analyticsSettingSchema = z.object({
  umamiWebsiteId: optionalText,
  metaPixelId: optionalText,
  metaPixelEnabled: z.boolean(),
});

export const antispamSettingSchema = z.object({ turnstileEnabled: z.boolean() });

export const SETTING_SCHEMAS = {
  shop: shopSettingSchema,
  appearance: appearanceSchema,
  currencies: currenciesSchema,
  notifications: notificationsSettingSchema,
  seo: seoSettingSchema,
  analytics: analyticsSettingSchema,
  antispam: antispamSettingSchema,
} as const;
export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;
export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const SETTING_DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  shop: {
    name: 'Bom Beauty',
    whatsapp: '+996706304803',
    instagramShop: 'bom_beauty.kr',
    instagramOwner: 'nurai.krsel',
    ownerName: 'Нурайым Бекиева',
    legalLine: 'ИП Бекиева Н.',
    footerNote: 'Доставка по Бишкеку и СНГ · отправка после 100% оплаты',
  },
  appearance: DEFAULT_APPEARANCE,
  currencies: Object.fromEntries(
    FOREIGN_CURRENCY_CODES.map((code) => [code, { enabled: true, rate: CURRENCIES[code].defaultRate }]),
  ) as CurrenciesSetting,
  notifications: {
    telegramEnabled: false,
    telegramChatId: null,
    emailEnabled: false,
    email: null,
    notifyLeads: false,
  },
  seo: {
    defaultTitle: 'Bom Beauty: профессиональная корейская косметика в Бишкеке',
    defaultDescription:
      'Готовые программы ухода от Нурайым и профессиональная корейская косметика. Доставка по Бишкеку и СНГ.',
    ogMediaId: null,
    googleVerification: null,
    yandexVerification: null,
  },
  analytics: { umamiWebsiteId: null, metaPixelId: null, metaPixelEnabled: false },
  antispam: { turnstileEnabled: false },
};

export const publicSettingsSchema = z.object({
  shop: shopSettingSchema,
  appearance: appearanceSchema,
  /** Enabled currencies, KGS first; `rate` as quoted in the admin (see CURRENCIES[code].inverse). */
  currencies: z.array(z.object({ code: z.enum(CURRENCY_CODES), rate: z.number() })),
  seo: seoSettingSchema.omit({ ogMediaId: true }).extend({ ogImage: imageRefSchema.nullable() }),
  analytics: z.object({ umamiWebsiteId: z.string().nullable(), metaPixelId: z.string().nullable() }),
  turnstileSiteKey: z.string().nullable(),
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
