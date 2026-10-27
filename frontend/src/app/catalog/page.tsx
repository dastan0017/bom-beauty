import { matchesSearch, productsWord } from '@bom/shared/web';
import type { Route } from 'next';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BbImage } from '@/components/bb-image';
import {
  CatalogBar,
  CatalogFiltersProvider,
  FiltersButton,
  FiltersSheet,
  RESULTS_ID,
} from '@/components/catalog/catalog-filters';
import { CatalogSearch } from '@/components/catalog/catalog-search';
import { ProductCard } from '@/components/catalog/product-card';
import { Price } from '@/components/currency';
import { ArrowRightIcon, CloseIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { CatalogBottomBar } from '@/components/sticky-bar';
import { AccentTitle, card, container, PageIntro, PageTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { catalogHref } from '@/lib/catalog-href';
import { getBrands, getCategories, getProducts, getProgramsSafe, getSettings } from '@/lib/data';
import { breadcrumbsLd } from '@/lib/seo';

type Param = string | string[] | undefined;
type Props = {
  searchParams: Promise<{ category?: Param; problem?: Param; brand?: Param; q?: Param }>;
};

const single = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);
const searchOf = (value: Param): string => (single(value) ?? '').trim().slice(0, 100);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const [categories, brands] = await Promise.all([
    getCategories().catch(() => []),
    getBrands().catch(() => []),
  ]);
  const current = categories.find((c) => c.slug === single(params.category));
  const brand = current ? undefined : brands.find((b) => b.slug === single(params.brand));
  return {
    title: current
      ? copy.seo.catalogCategory(current.name)
      : brand
        ? copy.seo.catalogCategory(brand.name)
        : copy.seo.catalog,
    description: copy.catalog.lead,
    // Category, brand and problem views are filters of one page; search results stay out of the index.
    alternates: {
      canonical: current
        ? `/catalog?category=${current.slug}`
        : brand
          ? `/catalog?brand=${brand.slug}`
          : '/catalog',
    },
    ...(searchOf(params.q) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = single(params.category);
  const query = searchOf(params.q);
  const [categories, products, programs, settings, brands] = await Promise.all([
    getCategories(),
    getProducts(category),
    getProgramsSafe(),
    getSettings(),
    getBrands(),
  ]);
  const active = categories.find((c) => c.slug === category);
  const problem = programs.find((program) => program.slug === single(params.problem));
  const brand = brands.find((b) => b.slug === single(params.brand));
  // A problem shows only the products of its program (README §5).
  const inProblem = problem ? new Set(problem.thumbs.map((thumb) => thumb.slug)) : null;
  const shown = products.filter(
    (product) =>
      (!inProblem || inProblem.has(product.slug)) &&
      (!brand || product.brand === brand.name) &&
      matchesSearch(query, [
        product.name,
        product.shortName,
        product.brand,
        product.purpose,
        product.category.name,
        product.volume,
      ]),
  );
  const filters = { problem: problem?.slug, category: active?.slug, brand: brand?.slug };
  const typeChips = [{ slug: undefined, name: copy.catalog.all }, ...categories.filter((c) => c.count > 0)];
  const problemChips = [
    { slug: undefined, name: copy.catalog.allProblems },
    ...programs.map((program) => ({ slug: program.slug, name: program.title })),
  ];
  const brandChips = [{ slug: undefined, name: copy.catalog.allBrands }, ...brands];
  const empty = shown.length === 0 ? emptyState({ query, filters, problem, active, brand }) : null;
  const here = catalogHref({ ...filters, q: query });
  // Chosen filters as removable pills under the bar.
  const pills = [
    problem && {
      key: 'problem',
      name: problem.title,
      href: catalogHref({ ...filters, problem: undefined, q: query }),
    },
    active && {
      key: 'category',
      name: active.name,
      href: catalogHref({ ...filters, category: undefined, q: query }),
    },
    brand && {
      key: 'brand',
      name: brand.name,
      href: catalogHref({ ...filters, brand: undefined, q: query }),
    },
  ].filter((pill) => pill !== undefined);
  const groups = [
    programs.length > 0 && {
      label: copy.catalog.byProblem,
      chips: problemChips.map((chip) => ({
        key: chip.slug ?? 'all',
        name: chip.name,
        href: catalogHref({ ...filters, problem: chip.slug, q: query }),
        on: chip.slug === problem?.slug,
      })),
    },
    {
      label: copy.catalog.byType,
      chips: typeChips.map((chip) => ({
        key: chip.slug ?? 'all',
        name: chip.name,
        href: catalogHref({ ...filters, category: chip.slug, q: query }),
        on: chip.slug === active?.slug,
      })),
    },
    brands.length > 1 && {
      label: copy.catalog.byBrand,
      chips: brandChips.map((chip) => ({
        key: chip.slug ?? 'all',
        name: chip.name,
        href: catalogHref({ ...filters, brand: chip.slug, q: query }),
        on: chip.slug === brand?.slug,
      })),
    },
  ].filter((group) => group !== false);

  return (
    <>
      <JsonLd
        data={breadcrumbsLd([
          { name: copy.common.toHome, path: '/' },
          { name: copy.header.tabs.catalog, path: '/catalog' },
        ])}
      />
      <PageIntro>
        <PageTitle>
          <AccentTitle text={`${copy.catalog.titleBefore}*${copy.catalog.titleAccent}*`} />
        </PageTitle>
        <p className="mt-3.5 self-stretch text-[17px] leading-[1.4] font-semibold">{copy.catalog.lead}</p>
        <p className="mt-1 self-stretch text-base leading-normal text-muted">
          {settings.payments.finik ? copy.catalog.noteOnline : copy.catalog.note}
        </p>
      </PageIntro>

      <CatalogFiltersProvider>
        <CatalogBar>
          <CatalogSearch query={query} filters={filters} className="flex-1 lg:max-w-[560px]" />
          <FiltersButton count={pills.length} />
        </CatalogBar>
        {pills.length > 0 && (
          <ul
            aria-label={copy.catalog.chosen}
            className={cn(container, 'no-scrollbar flex gap-2 overflow-x-auto px-4 pt-1 pb-2')}
          >
            {pills.map((pill) => (
              <li key={pill.key} className="flex-none">
                <Link
                  href={pill.href}
                  scroll={false}
                  aria-label={copy.catalog.removeFilter(pill.name)}
                  className="tap flex h-9 items-center gap-1.5 rounded-full bg-chip pr-2.5 pl-3.5 text-sm font-semibold whitespace-nowrap text-white"
                >
                  {pill.name}
                  <CloseIcon size={14} strokeWidth={2.6} className="opacity-80" />
                </Link>
              </li>
            ))}
            {pills.length > 1 && (
              <li className="flex-none">
                <Link
                  href={catalogHref({ q: query })}
                  scroll={false}
                  className="tap flex h-9 items-center px-2 text-sm font-semibold whitespace-nowrap text-muted hover:text-ink"
                >
                  {copy.catalog.resetFilters}
                </Link>
              </li>
            )}
          </ul>
        )}
        <FiltersSheet
          resultsHref={here}
          resultsLabel={
            shown.length
              ? copy.catalog.showResults(shown.length, productsWord(shown.length))
              : copy.catalog.nothingFound
          }
          resetHref={pills.length ? catalogHref({ q: query }) : null}
        >
          {groups.map((group) => (
            <FilterGroup key={group.label} label={group.label} chips={group.chips} />
          ))}
        </FiltersSheet>
      </CatalogFiltersProvider>

      {problem && (
        <div className={cn(container, 'px-4 pt-3')}>
          <Link
            href={`/programs/${problem.slug}`}
            className="flex items-center gap-3 rounded-card bg-accent-soft py-3 pr-3.5 pl-3 transition-transform active:scale-[.985] lg:max-w-[560px]"
          >
            <span className="relative h-[51px] w-16 flex-none overflow-hidden rounded-[10px] bg-media-placeholder">
              <BbImage image={problem.cover} sizes="64px" width={128} alt="" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] leading-[1.3] font-semibold">{copy.catalog.bannerTitle}</span>
              <span className="text-sm leading-[1.4] text-muted">
                «{problem.title}» · <Price kgs={problem.priceKgs} />
              </span>
            </span>
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface">
              <ArrowRightIcon size={16} />
            </span>
          </Link>
        </div>
      )}

      {query && shown.length > 0 && (
        <p role="status" className={cn(container, 'px-5 pt-4 text-sm text-muted')}>
          {copy.catalog.found(shown.length, productsWord(shown.length))}
        </p>
      )}

      {empty ? (
        <div role="status" className="flex flex-col items-center gap-3 px-6 pt-10 pb-2 text-center">
          <p className="text-base leading-normal text-balance text-muted">{empty.text}</p>
          <Link
            href={empty.action.href}
            scroll={false}
            className="flex h-11 items-center rounded-full border border-line bg-surface px-[18px] text-[15px] font-semibold text-ink"
          >
            {empty.action.label}
          </Link>
        </div>
      ) : (
        <section
          id={RESULTS_ID}
          className={cn(
            container,
            'grid grid-cols-2 gap-2.5 px-4 pt-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4',
          )}
        >
          {shown.map((product, index) => (
            <ProductCard key={product.slug} product={product} priority={index < 2} />
          ))}
          {shown.length === 0 && (
            <p className={cn(card, 'col-span-full px-5 py-6 text-center text-base text-muted')}>
              {copy.catalog.empty}
            </p>
          )}
        </section>
      )}

      <CatalogBottomBar />
    </>
  );
}

/** What an empty result says, and the link that widens it. Without filters or a query: the empty-category card. */
function emptyState({
  query,
  filters,
  problem,
  active,
  brand,
}: {
  query: string;
  filters: { problem?: string | undefined; category?: string | undefined; brand?: string | undefined };
  problem: { slug: string } | undefined;
  active: { slug: string; name: string } | undefined;
  brand: { slug: string } | undefined;
}): { text: string; action: { href: Route; label: string } } | null {
  if (query) {
    const filtered = Boolean(filters.problem || filters.category || filters.brand);
    return {
      text: copy.catalog.notFound(query),
      action: filtered
        ? { href: catalogHref({ q: query }), label: copy.catalog.searchEverywhere }
        : { href: '/catalog', label: copy.catalog.showAll },
    };
  }
  if (problem && active && !brand) {
    return {
      text: copy.catalog.emptyForProblem(active.name),
      action: { href: catalogHref({ problem: problem.slug }), label: copy.catalog.showAllTypes },
    };
  }
  if (problem || brand) {
    return {
      text: copy.catalog.emptyFiltered,
      action: { href: '/catalog', label: copy.catalog.resetFilters },
    };
  }
  return null;
}

/** One group of the filter sheet: a heading and wrapping chips (the design's chip style). */
function FilterGroup({
  label,
  chips,
}: {
  label: string;
  chips: { key: string; name: string; href: Route; on: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2.5 pt-5">
      <h3 className="text-[15px] font-semibold text-muted">{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              scroll={false}
              aria-current={chip.on ? 'page' : undefined}
              className={cn(
                'tap flex h-10 items-center rounded-full border px-4 text-[15px]',
                chip.on
                  ? 'border-chip bg-chip font-semibold text-white'
                  : 'border-line bg-surface text-ink hover:border-line-hover',
              )}
            >
              {chip.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
