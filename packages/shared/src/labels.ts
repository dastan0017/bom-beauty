import { itemsWord } from './plural';
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

/** "Cica-сыворотка × 2" for one order line. */
export function orderLineLabel(line: { title: string; qty: number }): string {
  return line.qty > 1 ? `${line.title} × ${line.qty}` : line.title;
}

/** Order column in the admin: the first line, plus "и ещё N" for a cart with more lines. */
export function orderSummary(lines: readonly { title: string; qty: number }[]): string {
  const [first] = lines;
  if (!first) return '—';
  return lines.length > 1 ? `${orderLineLabel(first)} и ещё ${lines.length - 1}` : orderLineLabel(first);
}

/** Kind under the order: "Программа", "Товар", or "Корзина · 3 товара" for several lines. */
export function orderKindLabel(lines: readonly { type: OrderItemType; qty: number }[]): string {
  const [first] = lines;
  if (!first) return '';
  if (lines.length === 1) return ORDER_ITEM_TYPE_LABELS[first.type];
  const units = lines.reduce((sum, line) => sum + line.qty, 0);
  return `Корзина · ${units} ${itemsWord(units)}`;
}

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  quiz: 'Тест',
  wholesale: 'Опт',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
};

/** Goal labels used in the admin's quiz matching select (design: Q_GOALS). */
export const QUIZ_GOAL_LABELS: Record<QuizGoal, string> = {
  acne: 'Высыпания, чёрные точки, комедоны',
  pigment: 'Пигментация, постакне, неровный тон',
  age: 'Упругость, морщины, овал лица',
  calm: 'Краснота, шелушения, чувствительность',
  glow: 'Тусклая кожа: сияние и увлажнение',
};

/** Skin type labels used in the admin's quiz matching chips (design: Q_SKINS). */
export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Жирная',
  combo: 'Комбинированная',
  dry: 'Сухая',
  sens: 'Чувствительная',
  normal: 'Нормальная',
};

export const ROUTINE_PERIOD_LABELS: Record<RoutinePeriod, string> = {
  am: 'Утро',
  pm: 'Вечер',
};

/** Badge options for products and programs. */
export const BADGES = ['Выбор Нурайым', 'Хит продаж', 'Хит эксперта', 'Новинка', 'Для зрелой кожи'] as const;
export type Badge = (typeof BADGES)[number];

/** Label of products in the «Новинки» rail; it wins over the product's own badge (README §1.6). */
export const NEW_BADGE: Badge = 'Новинка';

/** The one badge a product card shows. */
export function displayBadge(product: { badge: string | null; isNew: boolean }): string | null {
  return product.isNew ? NEW_BADGE : product.badge;
}

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
