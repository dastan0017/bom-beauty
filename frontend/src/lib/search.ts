import type { ProductCard, ProgramCard, SearchResult } from '@bom/shared';
import { rankSearch } from '@bom/shared/web';
import { programProductSlugs } from './program-summary';

type SearchProduct = Pick<ProductCard, 'slug' | 'name' | 'shortName' | 'brand'>;

/**
 * Programs matching the programs page's search (owner request 2026-11-14), best first: the query's words in the
 * program's title, symptoms or badge, or in the name, short name or brand of a product it lists in any variant
 * ("пенка", "PDRN"), with the shared search's endings, typos, alphabets and everyday words («прыщи» finds «Акне»).
 * An empty query keeps every program.
 */
export function searchPrograms(
  programs: readonly ProgramCard[],
  products: readonly SearchProduct[],
  query: string,
): SearchResult<ProgramCard> {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return rankSearch(
    programs,
    query,
    (program) => [
      program.title,
      { text: program.symptom, weight: 0.9 },
      { text: program.badge, weight: 0.5 },
      ...[...programProductSlugs(program)].flatMap((slug) => {
        const product = bySlug.get(slug);
        return product
          ? [
              { text: product.name, weight: 0.6 },
              { text: product.shortName, weight: 0.6 },
              { text: product.brand, weight: 0.5 },
            ]
          : [];
      }),
    ],
    4,
  );
}

/**
 * Products matching the catalog's search, best first: name, brand, category, purpose and volume, and the title and
 * symptoms of the programs that list the product, so a client who searches a problem («акне», «сухость») finds the
 * products picked for it (owner request 2026-11-14).
 */
export function searchProducts(
  products: readonly ProductCard[],
  programs: readonly ProgramCard[],
  query: string,
): SearchResult<ProductCard> {
  const problems = new Map<string, string[]>();
  if (query.trim()) {
    for (const program of programs) {
      for (const slug of programProductSlugs(program)) {
        problems.set(slug, [...(problems.get(slug) ?? []), program.title, program.symptom]);
      }
    }
  }
  return rankSearch(products, query, (product) => [
    product.name,
    product.shortName,
    { text: product.brand, weight: 0.9 },
    { text: product.category.name, weight: 0.8 },
    { text: product.purpose, weight: 0.8 },
    { text: product.volume, weight: 0.5 },
    ...(problems.get(product.slug) ?? []).map((text) => ({ text, weight: 0.5 })),
  ]);
}
