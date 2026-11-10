import type { ProgramCard } from '@bom/shared';
import { productsWord, programCardVariants } from '@bom/shared/web';

/**
 * Card figures of a program (design: progSum). A program with a choice shows the range of its variants:
 * «3–7 средств» and «от 3 900 сом»; one without shows «5 средств» and its price.
 */
export function programSummary(program: ProgramCard): { count: string; priceKgs: number; from: boolean } {
  const variants = programCardVariants(program);
  const counts = variants.map((variant) => variant.itemCount);
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  return {
    count: `${low === high ? '' : `${low}–`}${high} ${productsWord(high)}`,
    priceKgs: Math.min(...variants.map((variant) => variant.priceKgs)),
    from: variants.length > 1,
  };
}

/** Every product the program lists in any of its variants (the catalog's problem filter, design: probSet). */
export function programProductSlugs(program: ProgramCard): Set<string> {
  return new Set(
    programCardVariants(program).flatMap((variant) => variant.thumbs.map((thumb) => thumb.slug)),
  );
}
