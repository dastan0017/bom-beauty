// Domain value sets. Prisma enums mirror these (see docs/DATA-MODEL.md); a backend test keeps them equal.

export const ORDER_STATUSES = ['new', 'sent', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_TYPES = ['product', 'program'] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

/** How the customer chose to pay: online through Finik, or in WhatsApp (bank details or a payment link). */
export const PAYMENT_METHODS = ['whatsapp', 'finik'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Payment state of an order, beside its fulfilment status (docs/finik/SPEC.md §4.2). */
export const ORDER_PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'refunded'] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

/** One attempt to collect money through Finik. */
export const PAYMENT_STATUSES = ['created', 'pending', 'succeeded', 'failed', 'expired'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** `check` = the admin's 1 сом connection test, not tied to an order. */
export const PAYMENT_PURPOSES = ['order', 'check'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

/** How a successful payment was made, from the webhook's `service.id`. */
export const PAYMENT_CHANNELS = ['qr', 'visa'] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const LEAD_KINDS = ['quiz', 'wholesale'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const USER_ROLES = ['owner', 'manager'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUIZ_GOALS = ['acne', 'pigment', 'age', 'calm', 'glow'] as const;
export type QuizGoal = (typeof QUIZ_GOALS)[number];

export const SKIN_TYPES = ['oily', 'combo', 'dry', 'sens', 'normal'] as const;
export type SkinType = (typeof SKIN_TYPES)[number];

export const QUIZ_EXPERIENCES = ['pro', 'some', 'new'] as const;
export type QuizExperience = (typeof QUIZ_EXPERIENCES)[number];

/** Age bands in the quiz; they go to WhatsApp only and do not change the ranking. */
export const QUIZ_AGES = ['u25', '25', '35', '45'] as const;
export type QuizAge = (typeof QUIZ_AGES)[number];

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
