import type { Route } from 'next';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BbImage } from '@/components/bb-image';
import { ProductCard } from '@/components/catalog/product-card';
import { Price } from '@/components/currency';
import { ArrowRightIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { CatalogBottomBar } from '@/components/sticky-bar';
import { AccentTitle, card, container, PageIntro, PageTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getCategories, getProducts, getProgramsSafe } from '@/lib/data';
import { breadcrumbsLd } from '@/lib/seo';

type Props = { searchParams: Promise<{ category?: string | string[]; problem?: string | string[] }> };

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Catalog URL for a pair of filters; chips are links, so filtering works without JavaScript. */
function catalogHref(filters: { category?: string | undefined; problem?: string | undefined }): Route {
  const params = new URLSearchParams();
  if (filters.problem) params.set('problem', filters.problem);
  if (filters.category) params.set('category', filters.category);
  const query = params.toString();
  return (query ? `/catalog?${query}` : '/catalog') as Route;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const category = single((await searchParams).category);
  const categories = await getCategories().catch(() => []);
  const current = categories.find((c) => c.slug === category);
  return {
    title: current ? copy.seo.catalogCategory(current.name) : copy.seo.catalog,
    description: copy.catalog.lead,
    // Category and problem views are filters of one page.
    alternates: { canonical: current ? `/catalog?category=${current.slug}` : '/catalog' },
  };
}

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = single(params.category);
  const [categories, products, programs] = await Promise.all([
    getCategories(),
    getProducts(category),
    getProgramsSafe(),
  ]);
  const active = categories.find((c) => c.slug === category);
  const problem = programs.find((program) => program.slug === single(params.problem));
  // A problem shows only the products of its program (README §5).
  const inProblem = problem ? new Set(problem.thumbs.map((thumb) => thumb.slug)) : null;
  const shown = inProblem ? products.filter((product) => inProblem.has(product.slug)) : products;
  const typeChips = [{ slug: undefined, name: copy.catalog.all }, ...categories.filter((c) => c.count > 0)];
  const problemChips = [
    { slug: undefined, name: copy.catalog.allProblems },
    ...programs.map((program) => ({ slug: program.slug, name: program.title })),
  ];

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
        <p className="mt-1 self-stretch text-base leading-normal text-muted">{copy.catalog.note}</p>
      </PageIntro>

      {programs.length > 0 && (
        <ChipRow
          label={copy.catalog.byProblem}
          className="mt-[22px]"
          chips={problemChips.map((chip) => ({
            key: chip.slug ?? 'all',
            name: chip.name,
            href: catalogHref({ problem: chip.slug, category: active?.slug }),
            on: chip.slug === problem?.slug,
          }))}
        />
      )}
      <ChipRow
        label={copy.catalog.byType}
        className={programs.length > 0 ? 'mt-4' : 'mt-[22px]'}
        chips={typeChips.map((chip) => ({
          key: chip.slug ?? 'all',
          name: chip.name,
          href: catalogHref({ problem: problem?.slug, category: chip.slug }),
          on: chip.slug === active?.slug,
        }))}
      />

      {problem && (
        <div className={cn(container, 'px-4 pt-4')}>
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

      {shown.length === 0 && problem && active ? (
        <div className="flex flex-col items-center gap-3 px-6 pt-10 pb-2 text-center">
          <p className="text-base leading-normal text-balance text-muted">
            {copy.catalog.emptyForProblem(active.name)}
          </p>
          <Link
            href={catalogHref({ problem: problem.slug })}
            scroll={false}
            className="flex h-11 items-center rounded-full border border-line bg-surface px-[18px] text-[15px] font-semibold text-ink"
          >
            {copy.catalog.showAllTypes}
          </Link>
        </div>
      ) : (
        <section
          className={cn(
            container,
            'grid grid-cols-2 gap-2.5 px-4 pt-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4',
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

/** A labelled, horizontally scrolling row of filter chips (design: probChips, chips). */
function ChipRow({
  label,
  chips,
  className,
}: {
  label: string;
  chips: { key: string; name: string; href: Route; on: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(container, className)}>
      <span className="mx-5 block text-[13px] font-semibold text-muted lg:mx-0">{label}</span>
      <ul className="mt-2 no-scrollbar flex gap-2 overflow-x-auto px-4 lg:flex-wrap lg:px-0">
        {chips.map((chip) => (
          <li key={chip.key} className="flex-none">
            <Link
              href={chip.href}
              scroll={false}
              aria-current={chip.on ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center rounded-full border px-[18px] text-[15px] whitespace-nowrap',
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
