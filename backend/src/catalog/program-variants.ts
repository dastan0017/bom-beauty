import type { ProgramVariant } from '@bom/shared';

export interface VariantPrices {
  priceKgs: number;
  miniPriceKgs: number | null;
  maxPriceKgs: number | null;
}

export interface OfferedVariant<T> {
  variant: ProgramVariant;
  priceKgs: number;
  items: T[];
}

/**
 * The variants a program offers, in page order (Мини, Стандарт, Максимум). «Стандарт» is always there; «Мини» and
 * «Максимум» only while they have a price and at least one product (deleting a product can empty one).
 */
export function offeredVariants<T extends { variant: ProgramVariant }>(
  program: VariantPrices,
  items: readonly T[],
): OfferedVariant<T>[] {
  const of = (variant: ProgramVariant) => items.filter((item) => item.variant === variant);
  const extra = (variant: 'mini' | 'max', priceKgs: number | null): OfferedVariant<T>[] => {
    const list = of(variant);
    return priceKgs !== null && list.length ? [{ variant, priceKgs, items: list }] : [];
  };
  return [
    ...extra('mini', program.miniPriceKgs),
    { variant: 'standard', priceKgs: program.priceKgs, items: of('standard') },
    ...extra('max', program.maxPriceKgs),
  ];
}
