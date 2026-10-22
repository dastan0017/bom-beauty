/** Russian plural form: plural(5, 'средство', 'средства', 'средств') → 'средств'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  if (mod10 === 1 && mod100 !== 11) return one;
  return many;
}

export const productsWord = (n: number): string => plural(n, 'средство', 'средства', 'средств');
/** Units in the cart: "1 товар", "2 товара", "5 товаров". */
export const itemsWord = (n: number): string => plural(n, 'товар', 'товара', 'товаров');
export const stepsWord = (n: number): string => plural(n, 'шаг', 'шага', 'шагов');
export const programsWord = (n: number): string => plural(n, 'программа', 'программы', 'программ');
export const ordersWord = (n: number): string => plural(n, 'заказ', 'заказа', 'заказов');
