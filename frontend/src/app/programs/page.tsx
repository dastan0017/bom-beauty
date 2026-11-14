import { PROGRAMS_TEXT_DEFAULTS } from '@bom/shared';
import { GENERIC_QUESTION_MESSAGE, programsWord, splitAccent, waLink } from '@bom/shared/web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { TrackedLink } from '@/components/header-client';
import { QuizBanner } from '@/components/home/home-client';
import { ArrowRightIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { ProgramCard } from '@/components/program/program-card';
import { SearchBox } from '@/components/search-box';
import { QuizStickyBar } from '@/components/sticky-bar';
import { KeepResultsInView, StickyRow } from '@/components/sticky-row';
import { AccentTitle, card, container, PageIntro, PageTitle, SectionTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getContent, getPrograms, getProductsSafe, getSettings } from '@/lib/data';
import { searchPrograms } from '@/lib/search';
import { breadcrumbsLd } from '@/lib/seo';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

const SEARCH_ROW_ID = 'programs-search';
const RESULTS_ID = 'programs-results';

const searchOf = (value: string | string[] | undefined): string =>
  ((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, 100);

/** The tab title follows the owner's heading (D50), without the accent marks; search results stay out of the index. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [home, params] = await Promise.all([getContent('home').catch(() => null), searchParams]);
  const texts = home?.data.programs ?? PROGRAMS_TEXT_DEFAULTS;
  return {
    title: plainTitle(texts.pageTitle) || copy.seo.programs,
    description: texts.pageLead || copy.programs.lead,
    alternates: { canonical: '/programs' },
    ...(searchOf(params.q) ? { robots: { index: false, follow: true } } : {}),
  };
}

const plainTitle = (title: string): string =>
  splitAccent(title)
    .map((part) => part.text)
    .join('')
    .trim();

export default async function ProgramsPage({ searchParams }: Props) {
  const query = searchOf((await searchParams).q);
  const [programs, settings, home, products] = await Promise.all([
    getPrograms(),
    getSettings(),
    getContent('home').catch(() => null),
    // Product names make a program findable by what it contains (owner request 2026-11-14).
    query ? getProductsSafe() : Promise.resolve([]),
  ]);
  // The owner's headings (D50); the defaults if the texts cannot be read.
  const texts = home?.data.programs ?? PROGRAMS_TEXT_DEFAULTS;
  // Typos, other spellings and everyday words find a program too; the closest ones when none has every word (D53).
  const { found, similar } = searchPrograms(programs, products, query);
  const shown = found.length ? found : similar;

  return (
    <>
      <JsonLd
        data={breadcrumbsLd([
          { name: copy.common.toHome, path: '/' },
          { name: copy.header.tabs.programs, path: '/programs' },
        ])}
      />
      <PageIntro>
        <PageTitle>
          <AccentTitle text={texts.pageTitle} />
        </PageTitle>
        {texts.pageLead && (
          <p className="mt-3.5 max-w-[640px] self-stretch text-base leading-normal text-muted">
            {texts.pageLead}
          </p>
        )}
      </PageIntro>

      {/* Sticky under the header like the catalog's search (owner request 2026-11-14). */}
      {programs.length > 0 && (
        <StickyRow id={SEARCH_ROW_ID}>
          <SearchBox
            path="/programs"
            query={query}
            label={copy.programs.searchLabel}
            placeholder={copy.programs.searchPlaceholder}
            clearLabel={copy.catalog.clearSearch}
            className="flex-1 lg:max-w-[560px]"
          />
        </StickyRow>
      )}

      <KeepResultsInView query={query} rowId={SEARCH_ROW_ID} resultsId={RESULTS_ID} />
      <section
        id={RESULTS_ID}
        className={cn(container, 'flex flex-col gap-2.5 px-4 pt-3 lg:grid lg:grid-cols-2 lg:gap-4')}
      >
        {query && shown.length > 0 && (
          <p role="status" className="px-1 text-sm text-muted lg:col-span-2">
            {found.length
              ? copy.catalog.found(found.length, programsWord(found.length))
              : copy.programs.searchSimilar(query)}
          </p>
        )}
        {/* While searching, the results come first; the quiz is offered when nothing is found. */}
        {!query && <QuizBanner className="lg:col-span-2" />}
        {shown.map((program) => (
          <ProgramCard key={program.slug} program={program} />
        ))}
        {query && shown.length === 0 && (
          <div
            role="status"
            className="flex flex-col items-center gap-3 px-6 pt-6 pb-2 text-center lg:col-span-2"
          >
            <p className="text-base leading-normal text-balance text-muted">
              {copy.programs.searchNotFound(query)}
            </p>
            <Link
              href="/programs"
              scroll={false}
              className="flex h-11 items-center rounded-full border border-line bg-surface px-[18px] text-[15px] font-semibold text-ink"
            >
              {copy.programs.showAll}
            </Link>
          </div>
        )}
        {query && found.length === 0 && <QuizBanner className="mt-2 lg:col-span-2" />}
        {programs.length === 0 && (
          <p className={cn(card, 'px-5 py-6 text-center text-base text-muted lg:col-span-2')}>
            {copy.programs.empty}
          </p>
        )}
      </section>

      <section className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pt-14 lg:px-6 lg:pt-20">
        <SectionTitle center title={copy.programs.howTitle} lead={copy.programs.howLead} />
        <ol className={cn(card, 'flex flex-col lg:grid lg:grid-cols-3')}>
          {(settings.payments.finik
            ? [...copy.programs.how.slice(0, 2), copy.programs.howOnline]
            : copy.programs.how
          ).map((step, index) => (
            <li
              key={step.title}
              className={cn(
                'flex gap-3.5 px-[18px] py-5',
                index > 0 && 'border-t border-line-2 lg:border-t-0 lg:border-l',
              )}
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-ink">
                {index + 1}
              </span>
              <span className="flex flex-col gap-1 pt-1">
                <span className="text-[17px] leading-[1.3] font-semibold">{step.title}</span>
                <span className="text-base leading-normal text-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[15px]">
          <span className="text-muted">{copy.programs.notFound}</span>
          <TrackedLink
            href={waLink(settings.shop.whatsapp, GENERIC_QUESTION_MESSAGE)}
            event="whatsapp_click"
            place="programs"
            className="inline-flex h-11 items-center gap-1.5 font-semibold text-accent-ink"
          >
            {copy.programs.writeNurai}
            <ArrowRightIcon size={16} />
          </TrackedLink>
        </div>
      </section>

      <QuizStickyBar />
    </>
  );
}
