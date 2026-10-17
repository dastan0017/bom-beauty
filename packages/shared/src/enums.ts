// Domain value sets. Prisma enums mirror these (see docs/DATA-MODEL.md); a backend test keeps them equal.

export const ORDER_STATUSES = ['new', 'sent', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_TYPES = ['product', 'program'] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const LEAD_KINDS = ['quiz', 'wholesale'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const USER_ROLES = ['owner', 'manager'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUIZ_GOALS = ['age', 'pigment', 'acne', 'barrier'] as const;
export type QuizGoal = (typeof QUIZ_GOALS)[number];

export const SKIN_TYPES = ['dry', 'oily', 'normal', 'sens'] as const;
export type SkinType = (typeof SKIN_TYPES)[number];

export const QUIZ_EXPERIENCES = ['pro', 'mass', 'new'] as const;
export type QuizExperience = (typeof QUIZ_EXPERIENCES)[number];

export const QUIZ_FORMATS = ['set', 'wa'] as const;
export type QuizFormat = (typeof QUIZ_FORMATS)[number];

export const ROUTINE_PERIODS = ['am', 'pm'] as const;
export type RoutinePeriod = (typeof ROUTINE_PERIODS)[number];

export const THEME_KEYS = ['rose', 'sky', 'indigo'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const CURRENCY_CODES = ['KGS', 'USD', 'RUB', 'EUR', 'KZT', 'UZS', 'KRW'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const WHOLESALE_BUYERS = ['cosmo', 'clinic', 'salon', 'shop'] as const;
export type WholesaleBuyer = (typeof WHOLESALE_BUYERS)[number];

export const WHOLESALE_COUNTRIES = ['kg', 'kz', 'uz', 'ru'] as const;
export type WholesaleCountry = (typeof WHOLESALE_COUNTRIES)[number];
