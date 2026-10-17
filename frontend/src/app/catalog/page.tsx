import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/catalog/product-card';
import { JsonLd } from '@/components/json-ld';
import { QuizStickyBar } from '@/components/sticky-bar';
import { AccentTitle, card, container, PageIntro, PageTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getCategories, getProducts } from '@/lib/data';
import { breadcrumbsLd } from '@/lib/seo';

type Props = { searchParams: Promise<{ category?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const category = single((await searchParams).category);
  const categories = await getCategories().catch(() => []);
  const current = categories.find((c) => c.slug === category);
  return {
    title: current ? copy.seo.catalogCategory(current.name) : copy.seo.catalog,
    description: copy.catalog.lead,
    // Category views are filters of one page.
    alternates: { canonical: current ? `/catalog?category=${current.slug}` : '/catalog' },
  };
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function CatalogPage({ searchParams }: Props) {
  const category = single((await searchParams).category);
  const [categories, products] = await Promise.all([getCategories(), getProducts(category)]);
  const active = categories.some((c) => c.slug === category) ? category : undefined;
  const chips = [{ slug: undefined, name: copy.catalog.all }, ...categories.filter((c) => c.count > 0)];

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

      <nav aria-label={copy.header.tabs.catalog} className={cn(container, 'mt-[22px]')}>
        <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 lg:flex-wrap lg:px-0">
          {chips.map((chip) => {
            const on = chip.slug === active;
            return (
              <li key={chip.slug ?? 'all'} className="flex-none">
                <Link
                  href={chip.slug ? `/catalog?category=${chip.slug}` : '/catalog'}
                  scroll={false}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center rounded-full border px-[18px] text-[15px] whitespace-nowrap',
                    on
                      ? 'border-chip bg-chip font-semibold text-white'
                      : 'border-line bg-surface text-ink hover:border-line-hover',
                  )}
                >
                  {chip.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section
        className={cn(container, 'grid grid-cols-2 gap-2.5 px-4 pt-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4')}
      >
        {products.map((product, index) => (
          <ProductCard key={product.slug} product={product} priority={index < 2} />
        ))}
        {products.length === 0 && (
          <p className={cn(card, 'col-span-full px-5 py-6 text-center text-base text-muted')}>
            {copy.catalog.empty}
          </p>
        )}
      </section>

      <QuizStickyBar always />
    </>
  );
}
