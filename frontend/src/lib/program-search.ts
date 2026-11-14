import type { ProductCard, ProgramCard } from '@bom/shared';
import { matchesSearch } from '@bom/shared/web';
import { programProductSlugs } from './program-summary';

/**
 * Programs matching the programs page's search (owner request 2026-11-14): every word of the query in the program's
 * title, symptoms or badge, or in the name, short name or brand of a product it lists in any variant ("пенка",
 * "PDRN"), with Russian endings like the catalog search. An empty query keeps every program.
 */
export function searchPrograms(
  programs: readonly ProgramCard[],
  products: readonly Pick<ProductCard, 'slug' | 'name' | 'shortName' | 'brand'>[],
  query: string,
): ProgramCard[] {
  if (!query.trim()) return [...programs];
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return programs.filter((program) => {
    const items = [...programProductSlugs(program)].flatMap((slug) => {
      const product = bySlug.get(slug);
      return product ? [product.name, product.shortName, product.brand] : [];
    });
    return matchesSearch(query, [program.title, program.symptom, program.badge, ...items]);
  });
}
