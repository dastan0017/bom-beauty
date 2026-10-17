import type {
  LeadKind,
  OrderItemType,
  OrderStatus,
  QuizGoal,
  RoutinePeriod,
  SkinType,
  UserRole,
  WholesaleBuyer,
  WholesaleCountry,
} from './enums';

// Russian labels for domain values. Texts are verbatim from the design files.

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  sent: 'Отправлен',
  cancelled: 'Отменён',
};

export const ORDER_ITEM_TYPE_LABELS: Record<OrderItemType, string> = {
  product: 'Товар',
  program: 'Программа',
};

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  quiz: 'Тест',
  wholesale: 'Опт',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
};

/** Goal labels used in the admin's quiz matching select. */
export const QUIZ_GOAL_LABELS: Record<QuizGoal, string> = {
  age: 'Возрастные изменения / лифтинг',
  pigment: 'Пигментация / тусклый цвет',
  acne: 'Высыпания / акне',
  barrier: 'Восстановление и увлажнение',
};

/** Skin type labels used in the admin's quiz matching chips. */
export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  dry: 'Сухая',
  oily: 'Комбинированная / жирная',
  normal: 'Нормальная',
  sens: 'Чувствительная',
};

export const ROUTINE_PERIOD_LABELS: Record<RoutinePeriod, string> = {
  am: 'Утро',
  pm: 'Вечер',
};

/** Badge options for products and programs. */
export const BADGES = ['Выбор Нурайым', 'Хит продаж', 'Хит эксперта', 'Новинка', 'Для зрелой кожи'] as const;
export type Badge = (typeof BADGES)[number];

export const WHOLESALE_BUYER_LABELS: Record<WholesaleBuyer, { label: string; phrase: string }> = {
  cosmo: { label: 'Косметолог', phrase: 'Я косметолог' },
  clinic: { label: 'Клиника', phrase: 'Представляю клинику' },
  salon: { label: 'Салон', phrase: 'Представляю салон' },
  shop: { label: 'Магазин косметики', phrase: 'Представляю магазин косметики' },
};

export const WHOLESALE_COUNTRY_LABELS: Record<WholesaleCountry, { label: string; destination: string }> = {
  kg: { label: 'Кыргызстан', destination: 'Кыргызстан' },
  kz: { label: 'Казахстан', destination: 'Казахстан' },
  uz: { label: 'Узбекистан', destination: 'Узбекистан' },
  ru: { label: 'Россия', destination: 'Россию (Москва)' },
};
