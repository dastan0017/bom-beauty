import { PROGRAM_VARIANTS, type ProgramVariant } from './enums';
import type { ProgramCard, ProgramDetail, ProgramVariantCard, ProgramVariantDetail } from './schemas/catalog';

// Program variants (design: tiersOf, tierPick). A program always has «standard»; «mini» and «max» are optional.
// Their names are PROGRAM_VARIANT_LABELS (Базовый уход, Оптимальный уход, Интенсивный курс).

/**
 * The wanted variant when the program offers it, otherwise «standard» (design: tierPick). The list is never empty:
 * every program offers «standard».
 */
export function pickVariant<T extends { variant: ProgramVariant }>(
  variants: readonly T[],
  wanted?: ProgramVariant | null,
): T {
  const found =
    variants.find((v) => v.variant === wanted) ??
    variants.find((v) => v.variant === 'standard') ??
    variants[0];
  if (!found) throw new Error('A program has at least one variant');
  return found;
}

/** The variant to name in labels and messages: only programs with a choice name it. */
export function namedVariant(
  variants: readonly { variant: ProgramVariant }[],
  variant: ProgramVariant,
): ProgramVariant | null {
  return variants.length > 1 ? variant : null;
}

/** The card's variants; data cached before variants existed reads as «standard» only. */
export function programCardVariants(program: ProgramCard): ProgramVariantCard[] {
  if (program.variants.length) return program.variants;
  const { priceKgs, itemCount, thumbs } = program;
  return [{ variant: 'standard', priceKgs, itemCount, thumbs, sumKgs: 0 }];
}

/** A variant as the program cards list it (D48). */
export interface VariantOffer {
  variant: ProgramVariant;
  priceKgs: number;
  itemCount: number;
  /**
   * Its products bought one by one, shown crossed out next to the price; 0 when the set costs no less or the sum is
   * unknown (data cached before D48).
   */
  separatelyKgs: number;
}

/**
 * Every variant with its own price and the crossed-out price of its products one by one, in page order (owner
 * requests 2026-11-14: the cheaper set is seen on the cards, and the saving reads as an old price).
 */
export function variantOffers(program: ProgramCard): VariantOffer[] {
  return programCardVariants(program).map(({ variant, priceKgs, itemCount, sumKgs }) => ({
    variant,
    priceKgs,
    itemCount,
    separatelyKgs: sumKgs > priceKgs ? sumKgs : 0,
  }));
}

/** `?variant=mini` on a program link: the variant the page opens on, when it is a known one. */
export function parseVariant(value: string | null | undefined): ProgramVariant | null {
  return (PROGRAM_VARIANTS as readonly string[]).includes(value ?? '') ? (value as ProgramVariant) : null;
}

/** The program page's variants, with the same fallback as programCardVariants. */
export function programDetailVariants(program: ProgramDetail): ProgramVariantDetail[] {
  if (program.variants.length) return program.variants;
  const { priceKgs, itemCount, thumbs, items, sumKgs } = program;
  return [{ variant: 'standard', priceKgs, itemCount, thumbs, items, sumKgs }];
}
