import type { ProgramVariant } from './enums';
import type { ProgramCard, ProgramDetail, ProgramVariantCard, ProgramVariantDetail } from './schemas/catalog';

// Program variants (design: tiersOf, tierPick). A program always has «Стандарт»; «Мини» and «Максимум» are optional.

/**
 * The wanted variant when the program offers it, otherwise «Стандарт» (design: tierPick). The list is never empty:
 * every program offers «Стандарт».
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

/** The card's variants; data cached before variants existed reads as «Стандарт» only. */
export function programCardVariants(program: ProgramCard): ProgramVariantCard[] {
  if (program.variants.length) return program.variants;
  const { priceKgs, itemCount, thumbs } = program;
  return [{ variant: 'standard', priceKgs, itemCount, thumbs }];
}

/** The program page's variants, with the same fallback as programCardVariants. */
export function programDetailVariants(program: ProgramDetail): ProgramVariantDetail[] {
  if (program.variants.length) return program.variants;
  const { priceKgs, itemCount, thumbs, items, sumKgs } = program;
  return [{ variant: 'standard', priceKgs, itemCount, thumbs, items, sumKgs }];
}
